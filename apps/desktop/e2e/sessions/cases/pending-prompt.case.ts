// A new Session's prompt shows in its Feed right after Enter, before the Harness names the Session,
// and stays one row once the Harness's own Feed replaces it (#3052).
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { chooseHarness, openNewSessionByClick, sendFromComposer } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

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
  await backend.waitForReply(page, { harness, prompt })
  await expect(page).not.toHaveURL(/\/sessions\/new$/)
  // Every mock reply quotes the prompt, so a second match is the Harness's reply after its own prompt row.
  await expect(history.getByText(prompt)).not.toHaveCount(1)
  await expect(prompts).toHaveCount(1)
}
