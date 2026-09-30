import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { waitFor } from '../claude-proof-helpers'
import { createSessionByClick } from '../gestures'
import { sendSessionUpdate, sessionDetails } from '../page-trpc'

const RENAMED = 'Ticket: fix the Session List badge'

export async function proveClaudeRename(page, { backend, transcripts }) {
  const prompt = 'Open the rename proof.'
  const sessionId = await createSessionByClick(page, { harness: 'claude', prompt })
  await waitFor(() => backend.recorded({ harness: 'claude', prompt }))

  const beforeRename = await sessionDetails(page, sessionId)
  assert.deepEqual(beforeRename?.title, { text: prompt, source: 'first-prompt' })

  await sendSessionUpdate(page, { sessionIds: [sessionId], title: RENAMED })

  await waitFor(async () => {
    const names = await readdir(transcripts, { recursive: true }).catch(() => [])
    for (const name of names.filter((entry) => entry.endsWith('.jsonl'))) {
      const body = await readFile(path.join(transcripts, name), 'utf8')
      if (body.includes(`"customTitle":"${RENAMED}"`)) return true
    }
    return false
  })
  await waitFor(async () => {
    const row = await sessionDetails(page, sessionId)
    return row?.title?.source === 'custom' && row.title.text === RENAMED
  })
  const afterRename = await sessionDetails(page, sessionId)
  assert.deepEqual(afterRename?.title, { text: RENAMED, source: 'custom' })
}
