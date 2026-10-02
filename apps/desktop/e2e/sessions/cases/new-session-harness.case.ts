// A new Session opens on an installed Harness after the reader only looked at one that is not (#3005).
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { chooseHarness, openNewSessionByClick, TURN_CONFIGURATION } from '../gestures'
import { selectedProjectId, trpcCall } from '../page-trpc'

// Model and Effort show only once the composer restored its draft, so no restore can follow.
const CLAUDE_CODE = /^Choose Turn configuration: Claude Code, .+, .+$/
const CODEX = /^Choose Turn configuration: Codex, .+, .+$/

async function draftHarness(page: Page) {
  const projectId = await selectedProjectId(page)
  const draft = await trpcCall<{ target: { harness?: string } } | null>(page, {
    path: 'composerDraftRead',
    type: 'query',
    input: { type: 'project', projectId, worktree: { type: 'main' }, harness: 'claude' },
  })
  return draft?.target.harness ?? null
}

export async function proveNewSessionSkipsUninstalledHarness(
  page: Page,
  restart: () => Promise<Page>,
) {
  await openNewSessionByClick(page)
  await expect(page.locator(TURN_CONFIGURATION)).toHaveAttribute('aria-label', CLAUDE_CODE)
  await chooseHarness(page, 'claude-acp')
  await expect.poll(() => draftHarness(page)).toBe('claude-acp')

  const restarted = await restart()
  await openNewSessionByClick(restarted)
  await expect(restarted.locator(TURN_CONFIGURATION)).toHaveAttribute('aria-label', CLAUDE_CODE)
  await expect(restarted.getByText('Claude ACP is not installed.')).toHaveCount(0)

  // An installed Harness the reader picked is still remembered.
  await chooseHarness(restarted, 'codex')
  await expect.poll(() => draftHarness(restarted)).toBe('codex')
  const again = await restart()
  await openNewSessionByClick(again)
  await expect(again.locator(TURN_CONFIGURATION)).toHaveAttribute('aria-label', CODEX)
}
