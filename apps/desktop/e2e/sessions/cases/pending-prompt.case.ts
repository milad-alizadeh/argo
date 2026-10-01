// A new Session's prompt shows in its Feed right after Enter, before the Harness names the Session,
// and never leaves it while the Harness's own Feed takes over (#3052).
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { chooseHarness, openNewSessionByClick, sendFromComposer } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

// Counts each DOM change after which the Feed holds no prompt row. A newly opened Feed measures its
// rows before it draws them, so the measured copy counts.
function watchPromptGaps(prompt: string) {
  const page = window as { promptGaps?: number }
  page.promptGaps = 0
  new MutationObserver(() => {
    const feed = document.querySelector('[aria-label="Session Feed"]')
    if (!feed?.textContent?.includes(prompt)) page.promptGaps = (page.promptGaps ?? 0) + 1
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}

export async function provePromptBeforeNaming(
  page: Page,
  backend: SessionHarnessBackend,
  harness: SessionHarness,
) {
  const prompt = `Show this ${harness} prompt before any reply.`
  await openNewSessionByClick(page)
  await chooseHarness(page, harness)
  await sendFromComposer(page, prompt)
  const history = page.getByRole('region', { name: 'Session history' })
  const prompts = history.getByText(prompt, { exact: true })
  await prompts.waitFor()
  // The held Harness has not named the Session, so the prompt row is the app's own.
  assert.match(page.url(), /\/sessions\/new$/)
  await page.evaluate(watchPromptGaps, prompt)
  await backend.waitForReply(page, { harness, prompt })
  await expect(page).not.toHaveURL(/\/sessions\/new$/)
  await expect(prompts).toHaveCount(1)
  expect(await page.evaluate(() => (window as { promptGaps?: number }).promptGaps)).toBe(0)
  // The prompt belongs to the named Session: a later New Session opens without it (#3086).
  await openNewSessionByClick(page)
  await expect(prompts).toHaveCount(0)
}
