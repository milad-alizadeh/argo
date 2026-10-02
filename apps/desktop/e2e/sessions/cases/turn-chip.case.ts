// A new Session's Turn configuration chip keeps the model and effort the Send used, from the Send
// until the Session's details load (#3179).
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { chooseHarness, openNewSessionByClick, sendFromComposer } from '../gestures'
import { recordedLabels, watchLabels } from '../label-watch'
import type { SessionHarnessBackend } from '../session-harness-backend'

const TURN_CHIP = 'button[aria-label^="Choose Turn configuration"]'

const TURN_CHIP_WATCH = { selector: TURN_CHIP, key: 'turnChipLabels' }

export async function proveTurnChipKeepsConfiguration(
  page: Page,
  backend: SessionHarnessBackend,
  harness: SessionHarness,
) {
  const prompt = `Keep the ${harness} chip.`
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  const picked = await page.locator(TURN_CHIP).getAttribute('aria-label')
  expect(picked).not.toBeNull()
  await page.evaluate(watchLabels, TURN_CHIP_WATCH)
  await sendFromComposer(page, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect(page).not.toHaveURL(/\/sessions\/new$/)
  await expect.poll(() => recordedLabels(page, TURN_CHIP_WATCH.key)).toEqual([picked])
}
