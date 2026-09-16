import { expect, test } from '@playwright/test'

import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { defineSessionJourneyCases } from './cases/journeys.case'
import { selectProofProject } from './fixtures/feed.fixture'
import { createSessionByClick } from './gestures'
import {
  createPageBox,
  describeSessionProof,
  type PageBox,
  type SessionProofRun,
} from './session-proof-run'

const backend = createMockSessionCliBackend()

async function statusFor(page: Parameters<typeof createSessionByClick>[0], sessionId: string) {
  return page.evaluate(async (id) => {
    const reply = await window.argo.listSessions({ projectRoot: null })
    if (reply.type !== 'session.listed') return null
    return reply.sessions.find((session) => session.id === id)?.status ?? null
  }, sessionId)
}

function defineAdversarialLaunch(run: SessionProofRun, box: PageBox, seed: string) {
  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch({ adversarialSeed: seed }))
    expect(await run.isPackaged()).toBe(true)
  })
}

describeSessionProof('session-adversarial', backend, (run) => {
  const box = createPageBox(run.hold)

  defineAdversarialLaunch(run, box, 'seed-42')

  test('replays jitter, split bytes, and failure through Codex', async () => {
    const firstPrompt = 'Keep the adversarial reply complete.'
    const failedSessionId = await createSessionByClick(box.get(), {
      cli: 'codex',
      prompt: firstPrompt,
    })
    await expect(box.get().getByText(`Mock Codex read: ${firstPrompt} 🦜`)).toBeVisible()

    const composer = box.get().getByRole('textbox', { name: 'Message' })
    await composer.click()
    await box.get().keyboard.type('Fail this Turn.')
    await box.get().keyboard.press('Enter')
    await expect.poll(() => statusFor(box.get(), failedSessionId)).toBe('unknown')
    await expect(
      box.get().getByRole('button', { name: /Unknown Keep the adversarial reply complete/ }),
    ).toBeVisible()
  })
})

describeSessionProof('session-adversarial-stall', backend, (run) => {
  const box = createPageBox(run.hold)

  defineAdversarialLaunch(run, box, 'seed-17')

  test('shows the stalled reading for a Codex Turn with no Feed row', async () => {
    await createSessionByClick(box.get(), { cli: 'codex', prompt: 'Stall this Turn.' })
    await expect(box.get().locator('[data-state="stalled"]')).toBeVisible({ timeout: 12_000 })
  })
})

describeSessionProof('session-adversarial-permission', backend, (run) => {
  const box = createPageBox(run.hold)

  defineAdversarialLaunch(run, box, 'seed-0')

  test('sends the queued Turn after a seeded Claude Permission is allowed', async () => {
    const sessionId = await createSessionByClick(box.get(), {
      cli: 'claude',
      prompt: 'Wait for Permission.',
    })
    const composer = box.get().getByRole('textbox', { name: 'Message' })
    await expect(box.get().locator('.session-page__composer-permission')).toBeVisible()
    await composer.click()
    await box.get().keyboard.type('Queue this after Permission.')
    await box.get().keyboard.press('Enter')
    await expect(box.get().locator('.session-page__queued-message')).toContainText(
      'Queue this after Permission.',
    )
    await box.get().getByRole('button', { name: 'Allow', exact: true }).click()
    await expect(box.get().locator('.session-page__queued-message')).toBeHidden()
    await expect.poll(() => statusFor(box.get(), sessionId)).toBe('running')
  })
})

describeSessionProof('session-adversarial-journeys', backend, (run) => {
  const box = createPageBox(run.hold)
  defineAdversarialLaunch(run, box, 'alpha')
  defineSessionJourneyCases({ backend, box, fixture: () => run.fixture, restart: run.restart })
})
