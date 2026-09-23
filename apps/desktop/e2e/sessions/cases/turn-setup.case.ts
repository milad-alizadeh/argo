import { expect } from '@playwright/test'
import { chooseHarness, openNewSessionByClick, openSessionByClick, RUN_SETUP } from '../gestures'

const MODE = '[aria-label^="Choose permission mode"]'
const MESSAGE = '[aria-label="Message"]'

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
  await openSessionByClick(page, 'setupAnswered')
  await waitForSetup(page, 'Sonnet 5·High', 'Plan')

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
  await expect(page.locator(RUN_SETUP)).toBeFocused()

  await page.locator(MODE).focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('menu').waitFor()
  const auto = page.getByRole('menuitemradio', { name: /Auto/ })
  await auto.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menu').waitFor({ state: 'detached' })
  await waitForSetup(page, 'Haiku 4.5·Extra high', 'Auto')

  await openSessionByClick(page, 'prose')
  await openSessionByClick(page, 'setupAnswered')
  await waitForSetup(page, 'Haiku 4.5·Extra high', 'Auto')
}

// A draft and the harness a new Session was set to outlive a reload of the window.
export async function proveComposerMemory(page) {
  await openSessionByClick(page, 'setupAnswered')
  await page.locator(MESSAGE).click()
  await page.keyboard.type('Half a thought.')
  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')

  await page.reload()
  await page.waitForFunction(
    (selector) =>
      document
        .querySelector(selector)
        ?.getAttribute('aria-label')
        ?.startsWith('Choose run setup: Codex,') === true,
    RUN_SETUP,
    { timeout: 10_000 },
  )
  await openSessionByClick(page, 'setupAnswered')
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.textContent === 'Half a thought.',
    MESSAGE,
    { timeout: 10_000 },
  )
}

export async function proveLiveCodexModelChoices(page) {
  await openNewSessionByClick(page)
  await chooseHarness(page, 'codex')
  await page.locator(RUN_SETUP).click()
  const models = page.getByRole('radiogroup', { name: 'Model' })
  await expect(models.getByRole('radio', { name: /Mock Haiku/ })).toBeVisible()
  await expect(models.getByRole('radio', { name: /Mock Opus/ })).toBeVisible()
  await expect(models.getByRole('radio', { name: /Hidden mock model/ })).toHaveCount(0)

  await models.getByText('Mock Haiku', { exact: true }).click()
  const effort = page.getByRole('slider', { name: 'Effort' })
  await expect(effort).toHaveAttribute('max', '1')
  await expect(effort).toHaveAttribute('aria-valuetext', 'Low')

  await models.getByText('Mock Opus', { exact: true }).click()
  await expect(effort).toHaveAttribute('max', '2')
  await expect(effort).toHaveAttribute('aria-valuetext', 'High')
  await expect(page.getByText('Low', { exact: true })).toHaveCount(0)
  await effort.press('End')
  await expect(effort).toHaveAttribute('aria-valuetext', 'Extra high')

  await page.getByRole('tab', { name: 'Claude Code' }).click()
  await expect(
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: /Sonnet/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('radiogroup', { name: 'Model' }).getByRole('radio', { name: /Mock Opus/ }),
  ).toHaveCount(0)
}
