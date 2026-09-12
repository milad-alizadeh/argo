import assert from 'node:assert/strict'
import { appendFile, copyFile, utimes } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { listSessions } from '../sessions/read-sessions.ts'
import { fixturePath } from './session-fixture-files'
import { fixtureRoot } from './session-fixtures'

const listing = { version: 1, type: 'session.list', requestId: 'list-1' }
const firstMessage = `${JSON.stringify({
  type: 'assistant',
  uuid: 'e-a-2',
  parentUuid: 'e-a-1',
  timestamp: '2026-09-01T08:00:00.000Z',
  message: {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Done.' }],
  },
})}\n`

test('does not list transcripts without messages, but counts and re-reads them', async (context) => {
  const root = await fixtureRoot(context, [])
  const fixtures = path.join(import.meta.dir, 'fixtures', 'sessions')
  const empty = fixturePath(root, 'emptyTranscript')
  await copyFile(path.join(fixtures, 'emptyTranscript.jsonl'), empty)
  await copyFile(
    path.join(fixtures, 'nonMessageTranscript.jsonl'),
    fixturePath(root, 'nonMessageTranscript'),
  )

  const first = await listSessions(listing, root)
  assert.deepEqual(
    { found: first.filesFound, read: first.filesRead, sessions: first.sessions },
    { found: 2, read: 2, sessions: [] },
  )

  await appendFile(empty, firstMessage)
  const ahead = new Date(Date.now() + 2000)
  await utimes(empty, ahead, ahead)

  const second = await listSessions(listing, root)
  assert.deepEqual(
    {
      found: second.filesFound,
      read: second.filesRead,
      sessions: second.sessions.map((session) => session.id),
    },
    { found: 2, read: 2, sessions: ['emptyTranscript'] },
  )
})
