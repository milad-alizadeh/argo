// The Session contracts under the mock CLIs' seeded jitter, split bytes, stalls and failures.
import { createSessionByClick } from './gestures'
import { expect, test } from './session-proof-run'

async function statusFor(page: Parameters<typeof createSessionByClick>[0], sessionId: string) {
  return page.evaluate(async (id) => {
    const reply = await window.argo.listSessions({ projectRoot: null })
    if (reply.type !== 'session.listed') return null
    return reply.sessions.find((session) => session.id === id)?.status ?? null
  }, sessionId)
}

test.describe('session-adversarial', () => {
  test.use({ adversarialSeed: 'seed-42' })

  test('replays jitter, split bytes, and failure through Codex', async ({ session }) => {
    const page = session.page()
    const firstPrompt = 'Keep the adversarial reply complete.'
    const failedSessionId = await createSessionByClick(page, {
      cli: 'codex',
      prompt: firstPrompt,
    })
    await expect(page.getByText(`Mock Codex read: ${firstPrompt} 🦜`)).toBeVisible()

    const composer = page.getByRole('textbox', { name: 'Message' })
    await composer.click()
    await page.keyboard.type('Fail this Turn.')
    await page.keyboard.press('Enter')
    await expect.poll(() => statusFor(page, failedSessionId)).toBe('unknown')
    await expect(
      page.getByRole('button', { name: /Unknown Keep the adversarial reply complete/ }),
    ).toBeVisible()
  })
})

test.describe('session-adversarial-stall', () => {
  test.use({ adversarialSeed: 'seed-17' })

  test('shows the stalled reading for a Codex Turn with no Feed row', async ({ session }) => {
    const page = session.page()
    await createSessionByClick(page, { cli: 'codex', prompt: 'Stall this Turn.' })
    await expect(page.locator('[data-state="stalled"]')).toBeVisible({ timeout: 12_000 })
  })
})

test.describe('session-adversarial-permission', () => {
  test.use({ adversarialSeed: 'seed-15' })

  test('sends the queued Turn after a seeded Claude Permission is allowed', async ({ session }) => {
    const page = session.page()
    await createSessionByClick(page, {
      cli: 'claude',
      prompt: 'Wait for Permission.',
    })
    const composer = page.getByRole('textbox', { name: 'Message' })
    // Under parallel workers the seeded Claude start alone measured past the 5s default.
    await expect(page.locator('.session-page__composer-permission')).toBeVisible({
      timeout: 15_000,
    })
    await composer.click()
    await page.keyboard.type('Queue this after Permission.')
    await page.keyboard.press('Enter')
    await expect(page.locator('.session-page__queued-message')).toContainText(
      'Queue this after Permission.',
    )
    await page.getByRole('button', { name: 'Allow', exact: true }).click()
    await expect(page.locator('.session-page__queued-message')).toBeHidden()
    await expect(page.getByText('Mock Claude read: Queue this after Permission. 🦜')).toBeVisible()
  })
})
