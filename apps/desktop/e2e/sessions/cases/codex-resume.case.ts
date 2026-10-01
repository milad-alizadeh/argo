import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { createSessionByClick, openSessionByClick, sendFromComposer } from '../gestures'
import { sessionDetails } from '../page-trpc'
import type { SessionHarnessBackend } from '../session-harness-backend'

type Restart = () => Promise<Page>

const OPENING_PROMPT = 'Open the Codex resume proof.'
const RESUMING_PROMPT = 'Carry on after the restart.'

async function liveSessionListRow(page: Page, sessionId: string, budgetMs: number) {
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const row = await sessionDetails(page, sessionId)
    if (row?.posture === 'live') return row
    await setTimeout(100)
  }
  throw new Error(`Session ${sessionId} did not become live after resuming.`)
}

export async function provePackagedCodexResume(
  page: Page,
  { backend, restart }: { backend: SessionHarnessBackend; restart: Restart },
) {
  const sessionId = await createSessionByClick(page, { harness: 'codex', prompt: OPENING_PROMPT })
  // Restarting kills the spawned Codex CLI process, so its rollout file holds whatever it
  // flushed by then. Wait for the opening reply to land before restarting, or the file is still
  // empty when the app reopens and the index never picks the session up as a row at all (it has
  // no message record to stitch into a chain, so `reread` comes back `undefined`, not merely a
  // different posture).
  await backend.waitForReply(page, { harness: 'codex', prompt: OPENING_PROMPT })

  const relaunched = await restart()

  const reread = await sessionDetails(relaunched, sessionId)
  assert.equal(reread?.posture, null)
  await openSessionByClick(relaunched, sessionId)
  const history = relaunched.getByRole('region', { name: 'Session history' })
  await backend.waitForReply(relaunched, { harness: 'codex', prompt: OPENING_PROMPT })

  await sendFromComposer(relaunched, RESUMING_PROMPT)
  await backend
    .waitForReply(relaunched, { harness: 'codex', prompt: RESUMING_PROMPT })
    .catch(async (error) => {
      const rows = await history.locator('[data-feed-row]').allTextContents()
      const alerted = await relaunched.locator('[role="alert"]').allTextContents()
      const row = await sessionDetails(relaunched, sessionId)
      throw new Error(
        `${error.message}\nFeed rows: ${JSON.stringify(rows)}\nAlerts: ${JSON.stringify(alerted)}\nSessionList row: ${JSON.stringify(row)}`,
      )
    })
  // The optimistic Turn row (#2099) shows the sent prompt in the Feed before the Session List
  // invalidation that follows a Send lands, so the Session List's posture catches up on its own poll
  // rather than by the time the message is visible.
  const resumed = await liveSessionListRow(relaunched, sessionId, backend.budgetMs)
  assert.deepEqual({ id: resumed.id, posture: resumed.posture }, { id: sessionId, posture: 'live' })
  return relaunched
}
