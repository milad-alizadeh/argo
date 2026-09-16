import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

import { fakeClaudeFolder } from '../../../agents/claude/session-fake-driver/fake-claude-transcripts'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import { selectProofProject } from './session-feed-fixture'
import { createSessionByClick } from './session-gestures'
import { defineSessionJourneyCases } from './session-journey-cases'
import { createPageBox, describeSessionProof } from './session-proof-run'

const backend = createFakeSessionCliBackend()

async function statusFor(page: Parameters<typeof createSessionByClick>[0], sessionId: string) {
  return page.evaluate(async (id) => {
    const reply = await window.argo.listSessions({ projectRoot: null })
    if (reply.type !== 'session.listed') return null
    return reply.sessions.find((session) => session.id === id)?.status ?? null
  }, sessionId)
}

describeSessionProof('session-adversarial', backend, (run) => {
  const box = createPageBox(run.hold)

  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch({ adversarialSeed: 'seed-42' }))
    expect(await run.isPackaged()).toBe(true)
  })

  test('replays jitter, split bytes, and failure through Codex', async () => {
    const firstPrompt = 'Keep the adversarial reply complete.'
    const failedSessionId = await createSessionByClick(box.get(), {
      cli: 'codex',
      prompt: firstPrompt,
    })
    await expect(box.get().getByText(`Fake Codex read: ${firstPrompt} 🦜`)).toBeVisible()

    const composer = box.get().getByRole('textbox', { name: 'Message' })
    await composer.click()
    await box.get().keyboard.type('Fail this Turn.')
    await box.get().keyboard.press('Enter')
    await expect.poll(() => statusFor(box.get(), failedSessionId)).toBe('unknown')
  })
})

describeSessionProof('session-adversarial-stall', backend, (run) => {
  const box = createPageBox(run.hold)

  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch({ adversarialSeed: 'seed-6' }))
  })

  test('shows the stalled reading for a Codex Turn with no Feed row', async () => {
    await createSessionByClick(box.get(), { cli: 'codex', prompt: 'Stall this Turn.' })
    await expect(box.get().locator('[data-state="stalled"]')).toBeVisible({ timeout: 12_000 })
  })
})

describeSessionProof('session-adversarial-permission', backend, (run) => {
  const box = createPageBox(run.hold)

  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch({ adversarialSeed: 'seed-0' }))
  })

  test('shows a seeded Claude Permission while the fake holds its queued Turn', async () => {
    const sessionId = await createSessionByClick(box.get(), {
      cli: 'claude',
      prompt: 'Wait for Permission.',
    })
    await expect(box.get().locator('.session-page__composer-permission')).toBeVisible()
    const composer = box.get().getByRole('textbox', { name: 'Message' })
    await composer.click()
    await box.get().keyboard.type('Queue this after Permission.')
    await box.get().keyboard.press('Enter')
    const transcript = path.join(
      fakeClaudeFolder(run.fixture.claudeTranscripts),
      `${sessionId}.jsonl`,
    )
    await expect
      .poll(async () => (await readFile(transcript, 'utf8')).match(/"type":"user"/g)?.length)
      .toBe(1)
    await expect(box.get().locator('.session-page__queued-message')).toContainText(
      'Queue this after Permission.',
    )
  })
})

describeSessionProof('session-adversarial-journeys', backend, (run) => {
  const box = createPageBox(run.hold)

  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch({ adversarialSeed: 'alpha' }))
  })

  defineSessionJourneyCases({ backend, box, fixture: () => run.fixture, restart: run.restart })
})
