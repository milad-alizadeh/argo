import assert from 'node:assert/strict'

const RUN_SETUP = '[aria-label^="Choose run setup"]'
const MODE = '[aria-label^="Choose permission mode"]'

async function openSession(page, sessionId) {
  await page.evaluate((id) => {
    window.location.hash = `#/sessions/${id}`
  }, sessionId)
}

async function waitForSetup(page, runSetup, mode) {
  await page.waitForFunction(
    ({ selectors, expected }) =>
      document.querySelector(selectors.runSetup)?.textContent === expected.runSetup &&
      document.querySelector(selectors.mode)?.textContent === expected.mode,
    { selectors: { runSetup: RUN_SETUP, mode: MODE }, expected: { runSetup, mode } },
    { timeout: 10_000 },
  )
}

// The composer states the Model, Effort and Mode the Session's own records name, read through the
// shipped main process and preload, and a choice made by keyboard outlives a Session switch.
export async function proveTurnSetup(page) {
  await openSession(page, 'setupAnswered')
  await waitForSetup(page, 'Claude Code·Sonnet 5·High', 'Plan')

  await page.locator(RUN_SETUP).focus()
  await page.keyboard.press('Enter')
  const models = page.getByRole('radiogroup', { name: 'Model' })
  await models.getByRole('radio', { name: /Sonnet 5/ }).waitFor()
  await page.waitForFunction(() =>
    document.activeElement?.closest('label')?.textContent?.startsWith('Sonnet 5'),
  )
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Escape')
  await models.waitFor({ state: 'detached' })
  assert.equal(
    await page.evaluate((selector) => document.activeElement?.matches(selector), RUN_SETUP),
    true,
  )

  await page.locator(MODE).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('menu').waitFor()
  const auto = page.getByRole('menuitemradio', { name: /Auto/ })
  await auto.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menu').waitFor({ state: 'detached' })
  await waitForSetup(page, 'Claude Code·Haiku 4.5·Extra high', 'Auto')

  await openSession(page, 'prose')
  await page.waitForFunction(() => window.location.hash === '#/sessions/prose')
  await openSession(page, 'setupAnswered')
  await waitForSetup(page, 'Claude Code·Haiku 4.5·Extra high', 'Auto')
}
