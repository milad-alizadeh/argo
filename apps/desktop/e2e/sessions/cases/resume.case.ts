import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import { expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import type { Harness } from '@/harnesses/harness'
import { createSessionByClick, openSessionByClick, sendFromComposer } from '../gestures'
import { sessionDetails } from '../page-trpc'
import type { SessionHarnessBackend } from '../session-harness-backend'

type Restart = () => Promise<Page>

const OPENING_PROMPT = 'Open the resume proof.'
const RESUMING_PROMPT = 'Carry on after the restart.'
const COMPACTED_PROMPT = 'Carry on after compacting.'

async function liveSessionListRow(page: Page, sessionId: string, budgetMs: number) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const row = await sessionDetails(page, sessionId)
    if (row?.posture === 'live') return row
    await setTimeout(100)
  }
  throw new Error(`Session ${sessionId} did not become live after resuming.`)
}

// A refused resume swaps the composer for an alert, so a plain timeout names nothing useful.
async function reportStalledReply(page: Page, sessionId: string, error: Error): Promise<never> {
  const history = page.getByRole('region', { name: 'Session history' })
  const rows = await history.locator('[data-feed-row]').allTextContents()
  const alerted = await page.locator('[role="alert"]').allTextContents()
  const row = await sessionDetails(page, sessionId)
  throw new Error(
    `${error.message}\nFeed rows: ${JSON.stringify(rows)}\nAlerts: ${JSON.stringify(alerted)}\nSessionList row: ${JSON.stringify(row)}`,
  )
}

// Compact context from the composer's context actions, as a person would (#2967).
async function compactByClick(page: Page) {
  await page.getByRole('button', { name: 'Context actions' }).click()
  const compact = page.getByRole('menuitem', { name: 'Compact context' })
  await expect(compact).toBeEnabled()
  await compact.click()
  const history = page.getByRole('region', { name: 'Session history' })
  const marker = history.getByRole('article').filter({ hasText: /^Conversation compacted$/ })
  await expect(marker).toBeVisible()
}

// A Session Argo started stays listed after a restart; its next Turn resumes it into a live
// channel, Compact context compacts it there, and a later Turn still answers.
export async function proveResumeAndCompact(
  page: Page,
  {
    backend,
    harness,
    restart,
  }: { backend: SessionHarnessBackend; harness: Harness; restart: Restart },
) {
  const sessionId = await createSessionByClick(page, { harness, prompt: OPENING_PROMPT })
  // Restarting kills the spawned CLI process, so its transcript holds whatever it flushed by then.
  // Wait for the opening reply, or the reopened app may not list the Session at all.
  await backend.waitForReply(page, { harness, prompt: OPENING_PROMPT })

  const relaunched = await restart()

  const reread = await sessionDetails(relaunched, sessionId)
  assert.equal(reread?.posture, null)
  await openSessionByClick(relaunched, sessionId)
  await backend.waitForReply(relaunched, { harness, prompt: OPENING_PROMPT })

  await sendFromComposer(relaunched, RESUMING_PROMPT)
  await backend
    .waitForReply(relaunched, { harness, prompt: RESUMING_PROMPT })
    .catch((error) => reportStalledReply(relaunched, sessionId, error))
  // The optimistic Turn row (#2099) shows the prompt before the Session List's posture catches up
  // on its own poll.
  const resumed = await liveSessionListRow(relaunched, sessionId, backend.budgetMs)
  assert.deepEqual({ id: resumed.id, posture: resumed.posture }, { id: sessionId, posture: 'live' })

  await compactByClick(relaunched)
  await sendFromComposer(relaunched, COMPACTED_PROMPT)
  await backend
    .waitForReply(relaunched, { harness, prompt: COMPACTED_PROMPT })
    .catch((error) => reportStalledReply(relaunched, sessionId, error))
  return relaunched
}
