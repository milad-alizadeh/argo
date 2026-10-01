import assert from 'node:assert/strict'
import path from 'node:path'
import { claudeSessions } from '../../../mocks/cli/claude/claude-sdk-reader'
import { waitFor } from '../claude-proof-helpers'
import { createSessionByClick } from '../gestures'
import { sendSessionUpdate, sessionDetails } from '../page-trpc'

const RENAMED = 'Ticket: fix the Session List badge'

export async function proveClaudeRename(page, { backend, transcripts }) {
  const prompt = 'Open the rename proof.'
  const sessionId = await createSessionByClick(page, { harness: 'claude', prompt })
  await waitFor(() => backend.recorded({ harness: 'claude', prompt }))

  const beforeRename = await sessionDetails(page, sessionId)
  assert.equal(beforeRename?.name, prompt)

  await sendSessionUpdate(page, { sessionIds: [sessionId], title: RENAMED })

  // The Harness's own reader shows the title Argo wrote into the Session.
  const configDirectory = path.dirname(transcripts)
  await waitFor(async () =>
    (await claudeSessions(configDirectory)).some((session) => session.customTitle === RENAMED),
  )
  await waitFor(async () => {
    const row = await sessionDetails(page, sessionId)
    return row?.name === RENAMED
  })
  const afterRename = await sessionDetails(page, sessionId)
  assert.equal(afterRename?.name, RENAMED)
}
