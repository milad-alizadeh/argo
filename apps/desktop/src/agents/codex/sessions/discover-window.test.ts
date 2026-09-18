// The Codex adapter's own bounded discovery (#2239): enough transcripts to cross ROSTER_PAGE_SIZE,
// proving a file outside the initial window is unread on first discovery but reachable once the
// window grows or a specific id is requested.
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '../../../domains/sessions/main/discover-transcript-sessions'
import { createSessionReader } from '../../../domains/sessions/main/reader'
import { assertWindowGrowsToFarSession } from '../../../domains/sessions/main/window-proof-helpers'
import { codexSessionSource } from './read-sessions'

function codexMessage(text: string, updatedAt: string) {
  return `${JSON.stringify({
    timestamp: updatedAt,
    type: 'event_msg',
    payload: {
      type: 'agent_message',
      item: { type: 'AgentMessage', id: 'm', content: [{ type: 'text', text }] },
    },
  })}\n`
}

async function writeManySessions(root: string, count: number) {
  const day = path.join(root, '2026', '09', '13')
  await mkdir(day, { recursive: true })
  const base = Date.parse('2026-09-13T12:00:00.000Z')
  for (let index = 0; index < count; index += 1) {
    const writtenAt = new Date(base - index * 60_000).toISOString()
    const file = path.join(day, `s${index}.jsonl`)
    await writeFile(
      file,
      `${JSON.stringify({
        timestamp: writtenAt,
        type: 'session_meta',
        payload: { id: `s${index}` },
      })}\n${codexMessage('Hi.', writtenAt)}`,
    )
    await utimes(file, new Date(writtenAt), new Date(writtenAt))
  }
}

test('a Session outside the initial window is unread on first discovery, but reachable by growing the cursor or asking for it by id', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-window-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const farId = `s${ROSTER_PAGE_SIZE + 5}`
  const reader = createSessionReader([codexSessionSource(root)])

  await assertWindowGrowsToFarSession(reader, farId)
})
