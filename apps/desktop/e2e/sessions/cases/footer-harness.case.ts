// A new Session's footer never shows another Harness's usage after Send; it may be empty while the
// Session's details load (#3171).
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { chooseHarness, openNewSessionByClick, sendFromComposer } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

export const USAGE_BUTTON = '[data-component="SessionContextBar"] button[aria-label^="Usage"]'

// Records each Usage label an open Session's footer commits, so a label shown for one frame still
// counts. It watches the document node, so it also runs as an init script before the root exists.
export function watchUsageLabels(selector: string) {
  const labels: string[] = []
  const record = () => {
    if (/\/sessions\/new(\?|$)/.test(location.hash)) return
    const label = document.querySelector(selector)?.getAttribute('aria-label')
    if (label && labels.at(-1) !== label) labels.push(label)
  }
  record()
  new MutationObserver(record).observe(document, {
    attributes: true,
    childList: true,
    subtree: true,
  })
  Object.assign(window, { usageLabels: labels })
}

export function usageLabels(page: Page) {
  return page.evaluate(() => (window as { usageLabels?: string[] }).usageLabels)
}

export async function proveFooterKeepsHarness(
  page: Page,
  backend: SessionHarnessBackend,
  harness: SessionHarness,
) {
  const prompt = `Keep the ${harness} footer.`
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  const picked = await page.locator(USAGE_BUTTON).getAttribute('aria-label')
  expect(picked).not.toBeNull()
  await page.evaluate(watchUsageLabels, USAGE_BUTTON)
  await sendFromComposer(page, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect(page).not.toHaveURL(/\/sessions\/new$/)
  expect(await usageLabels(page)).toEqual([picked])
}
