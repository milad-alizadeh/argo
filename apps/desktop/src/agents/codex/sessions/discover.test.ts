import assert from 'node:assert/strict'
import { appendFile, copyFile, mkdir, mkdtemp, rm, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { listSessions } from './read-sessions'

const listing = { version: 1, type: 'session.list', requestId: 'list-1' }

function listed(reply: Awaited<ReturnType<typeof listSessions>>) {
  if (reply.type !== 'session.listed') throw new Error(`Expected sessions, received ${reply.type}.`)
  return reply
}

test('does not list transcripts without messages, but counts and re-reads them', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-sessions-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '12')
  await mkdir(day, { recursive: true })
  const fixtures = path.join(
    process.cwd(),
    'src',
    'agents',
    'codex',
    'session-fake-driver',
    'fixtures',
    'sessions',
  )
  const empty = path.join(day, 'emptyTranscript.jsonl')
  await copyFile(path.join(fixtures, 'emptyTranscript.jsonl'), empty)
  await copyFile(
    path.join(fixtures, 'nonMessageTranscript.jsonl'),
    path.join(day, 'nonMessageTranscript.jsonl'),
  )

  const first = listed(await listSessions(listing, root))
  assert.deepEqual(
    { found: first.filesFound, read: first.filesRead, sessions: first.sessions },
    { found: 2, read: 2, sessions: [] },
  )

  await appendFile(
    empty,
    `${JSON.stringify({
      timestamp: '2026-09-12T08:00:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        thread_id: 'emptyTranscript',
        item: {
          type: 'AgentMessage',
          id: 'first-message',
          content: [{ type: 'text', text: 'The first message.' }],
        },
      },
    })}\n`,
  )
  const ahead = new Date(Date.now() + 2000)
  await utimes(empty, ahead, ahead)

  const second = listed(await listSessions(listing, root))
  assert.deepEqual(
    {
      found: second.filesFound,
      read: second.filesRead,
      sessions: second.sessions.map((session) => session.id),
    },
    { found: 2, read: 2, sessions: ['emptyTranscript'] },
  )
})
