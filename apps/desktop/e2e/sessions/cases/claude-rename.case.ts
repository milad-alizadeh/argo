import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { rosterRow, waitFor } from '../claude-proof-helpers'
import { createSessionByClick } from '../gestures'
import { renameSession } from '../page-trpc'

const RENAMED = 'Ticket: fix the roster badge'

export async function proveClaudeRename(page, { backend, transcripts }) {
  const prompt = 'Open the rename proof.'
  const sessionId = await createSessionByClick(page, { harness: 'claude', prompt })
  await waitFor(() => backend.recorded({ harness: 'claude', prompt }))

  const [beforeRename] = await rosterRow(page, sessionId)
  assert.deepEqual(beforeRename?.title, { text: prompt, source: 'first-prompt' })

  const renamed = await renameSession(page, sessionId, RENAMED)
  assert.equal(renamed.title, RENAMED)

  const folder = path.join(transcripts, 'mock-claude')
  await waitFor(async () => {
    const names = await readdir(folder).catch(() => [])
    for (const name of names) {
      const body = await readFile(path.join(folder, name), 'utf8')
      if (body.includes(`"customTitle":"${RENAMED}"`)) return true
    }
    return false
  })
  await waitFor(async () => {
    const [row] = await rosterRow(page, sessionId)
    return row?.title?.source === 'custom' && row.title.text === RENAMED
  })
  const [afterRename] = await rosterRow(page, sessionId)
  assert.deepEqual(afterRename?.title, { text: RENAMED, source: 'custom' })
}
