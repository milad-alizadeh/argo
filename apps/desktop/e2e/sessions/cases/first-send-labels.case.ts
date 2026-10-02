// From the first Send in a new Session until its details load, the footer never shows another
// Harness's usage (#3171) and the Turn configuration chip keeps the model and effort it sent
// (#3179). Neither control vanishes on the way.
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { chooseHarness, openNewSessionByClick, sendFromComposer } from '../gestures'
import { type LabelWatch, recordedLabels, watchLabels } from '../label-watch'
import type { SessionHarnessBackend } from '../session-harness-backend'

export const USAGE_BUTTON = '[data-component="SessionContextBar"] button[aria-label^="Usage"]'

// An opened or reloaded Session draws no usage until its details load, so absence is not recorded.
export const USAGE_WATCH: LabelWatch = {
  selector: USAGE_BUTTON,
  key: 'usageLabels',
  missing: false,
}

export const TURN_CHIP_WATCH: LabelWatch = {
  selector: 'button[aria-label^="Choose Turn configuration"]',
  key: 'turnChipLabels',
  missing: true,
}

export function usageLabels(page: Page) {
  return recordedLabels(page, USAGE_WATCH.key)
}

export async function proveFirstSendKeepsLabel(
  page: Page,
  backend: SessionHarnessBackend,
  { harness, watch }: { harness: SessionHarness; watch: LabelWatch },
) {
  const prompt = `Keep the ${harness} ${watch.key}.`
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  const picked = await page.locator(watch.selector).getAttribute('aria-label')
  expect(picked).not.toBeNull()
  await page.evaluate(watchLabels, watch)
  await sendFromComposer(page, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect(page).not.toHaveURL(/\/sessions\/new$/)
  await expect.poll(() => recordedLabels(page, watch.key)).toEqual([picked])
}
