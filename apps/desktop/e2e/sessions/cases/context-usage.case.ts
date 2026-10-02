// The composer's context bar shows how full the newest Turn left the context window, as the
// Harness reported it when the Turn ended (#2968).
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { MOCK_CONTEXT_USAGE } from '../../../mocks/cli/mock-context-usage'
import { createSessionByClick } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const CONTEXT_BAR = '[data-component="SessionContextBar"]'

// The tokens, window and share the popover states; a real CLI reports its own numbers.
type ReportingHarness = Extract<Harness, 'claude' | 'codex'>

function expectedUsage(backend: SessionHarnessBackend, harness: ReportingHarness) {
  if (backend.name !== 'mock') return { tokens: /\d+k \/ \d+k tokens/, share: /\d+% used/ }
  const { usedTokens, windowTokens } = MOCK_CONTEXT_USAGE[harness]
  const percentage = Math.round((usedTokens / windowTokens) * 100)
  return {
    tokens: `${usedTokens / 1000}k / ${windowTokens / 1000}k tokens`,
    share: `${percentage}% used`,
  }
}

export async function proveContextUsage(
  page: Page,
  backend: SessionHarnessBackend,
  harness: ReportingHarness,
) {
  const prompt = `Report the ${harness} context usage.`
  await createSessionByClick(page, { harness, prompt })
  await backend.waitForReply(page, { harness, prompt })
  const trigger = page
    .locator(CONTEXT_BAR)
    .getByRole('button', { name: /^Context / })
    .first()
  await expect(trigger).not.toHaveAccessibleName(/total not reported/)
  await trigger.click()
  const details = page.getByRole('dialog', { name: 'Context window' })
  const expected = expectedUsage(backend, harness)
  await expect(details).toContainText(expected.tokens)
  await expect(details).toContainText(expected.share)
  await page.keyboard.press('Escape')
}
