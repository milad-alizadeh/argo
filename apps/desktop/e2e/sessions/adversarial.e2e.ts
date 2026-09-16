import { expect } from '@playwright/test'

import { selectProofProject } from './fixtures/feed.fixture'
import { createSessionByClick } from './gestures'
import {
  createPageBox,
  describeSessionProof,
  type PageBox,
  type SessionProofRun,
  test,
} from './session-proof-run'

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

describeSessionProof('session-adversarial', (run) => {
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

describeSessionProof('session-adversarial-stall', (run) => {
  const box = createPageBox(run.hold)

  defineAdversarialLaunch(run, box, 'seed-17')

  test('shows the stalled reading for a Codex Turn with no Feed row', async () => {
    await createSessionByClick(box.get(), { cli: 'codex', prompt: 'Stall this Turn.' })
    await expect(box.get().locator('[data-state="stalled"]')).toBeVisible({ timeout: 12_000 })
  })
})

describeSessionProof('session-adversarial-permission', (run) => {
  const box = createPageBox(run.hold)

  defineAdversarialLaunch(run, box, 'seed-15')

  test('sends the queued Turn after a seeded Claude Permission is allowed', async () => {
    await createSessionByClick(box.get(), {
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
    await expect(
      box.get().getByText('Mock Claude read: Queue this after Permission. 🦜'),
    ).toBeVisible()
  })
})
