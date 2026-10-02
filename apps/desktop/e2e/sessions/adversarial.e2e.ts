// The Session contracts under the mock CLIs' seeded jitter, split bytes, stalls and failures.
import { createSessionByClick } from './gestures'
import { sessionDetails, sessionRows } from './page-trpc'
import { expect, test } from './session-proof-run'

async function statusFor(page: Parameters<typeof createSessionByClick>[0], sessionId: string) {
  const rows = await sessionRows(page)
  return rows.find((session) => session.id === sessionId)?.status ?? null
}

async function postureFor(page: Parameters<typeof createSessionByClick>[0], sessionId: string) {
  return (await sessionDetails(page, sessionId))?.posture ?? null
}

test.describe('session-adversarial', () => {
  test.use({ adversarialSeed: 'seed-42' })

  test('replays jitter, split bytes, and failure through Codex', async ({ session }) => {
    const page = session.page()
    const firstPrompt = 'Keep the adversarial reply complete.'
    const failedSessionId = await createSessionByClick(page, {
      harness: 'codex',
      prompt: firstPrompt,
    })
    await expect(page.getByText(`Mock Codex read: ${firstPrompt} 🦜`)).toBeVisible()
    await expect.poll(() => postureFor(page, failedSessionId)).toBe('live')

    const composer = page.getByRole('combobox', { name: 'Message' })
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

  // A Turn that never replies keeps the running loader past the stall bound, with no Retry (#3170).
  test('keeps the running loader for a Codex Turn that never replies', async ({ session }) => {
    const page = session.page()
    await createSessionByClick(page, { harness: 'codex', prompt: 'Stall this Turn.' })
    // Past the Feed's 8 s stall bound (FEED_STALL_TIMEOUT_MS).
    await page.waitForTimeout(10_000)
    await expect(page.getByRole('status', { name: 'Loading this Session' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  })
})

test.describe('session-adversarial-permission', () => {
  test.use({ adversarialSeed: 'seed-15' })

  test('sends the queued Turn after a seeded Claude Permission is allowed', async ({ session }) => {
    const page = session.page()
    await createSessionByClick(page, {
      harness: 'claude',
      prompt: 'Wait for Permission.',
    })
    const composer = page.getByRole('combobox', { name: 'Message' })
    // Under parallel workers the seeded Claude start alone measured past the 5s default.
    await expect(page.getByRole('region', { name: 'Permission needed' })).toBeVisible({
      timeout: 15_000,
    })
    await composer.click()
    await page.keyboard.type('Queue this after Permission.')
    await page.keyboard.press('Enter')
    const reply = page.getByText('Mock Claude read: Queue this after Permission. 🦜')
    // Enter took the prompt while the Permission still holds the Turn, so its reply waits for Allow.
    await expect(composer).toHaveText('')
    await expect(page.getByRole('region', { name: 'Permission needed' })).toBeVisible()
    await expect(reply).toHaveCount(0)
    await page.getByRole('button', { name: 'Allow', exact: true }).click()
    await expect(reply).toBeVisible()
  })
})
