import assert from 'node:assert/strict'
import { claudeConfigDirectory } from '../../../mocks/cli/claude/mock-claude-transcripts'
import { waitFor } from '../claude-proof-helpers'
import { createSessionByClick } from '../gestures'
import { sendSessionUpdate, sessionDetails } from '../page-trpc'
import { claudeSessions } from '../real-harness/claude-vendor-reader'

const RENAMED = 'Ticket: fix the Session List badge'

export async function proveClaudeRename(page, { backend, transcripts }) {
  const prompt = 'Open the rename proof.'
  const sessionId = await createSessionByClick(page, { harness: 'claude', prompt })
  await waitFor(() => backend.recorded({ harness: 'claude', prompt }))

  const beforeRename = await sessionDetails(page, sessionId)
  assert.equal(beforeRename?.name, prompt)

  await sendSessionUpdate(page, { sessionIds: [sessionId], title: RENAMED })

  // The Harness's own reader shows the title Argo wrote into the Session.
  const configDirectory = claudeConfigDirectory(transcripts)
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
