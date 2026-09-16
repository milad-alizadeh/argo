import assert from 'node:assert/strict'
import { appendFile, copyFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { sessionFeedReplySchema, sessionListReplySchema } from '@/core/sessions/contract'
import { createSessionReader } from '@/core/sessions/reader'
import { codexSessionSource } from './read-sessions'

const listing = {
  version: 1 as const,
  type: 'session.list' as const,
  requestId: 'list-1',
  projectRoot: null,
}

function listSessions(value: unknown, root: string) {
  return createSessionReader([codexSessionSource(root)]).listSessions(value as never)
}

function listed(reply: Awaited<ReturnType<typeof listSessions>>) {
  const parsed = sessionListReplySchema.parse(reply)
  if (parsed.type !== 'session.listed')
    throw new Error(`Expected sessions, received ${parsed.type}.`)
  return parsed
}

test('does not list transcripts without messages, but counts and re-reads them', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-sessions-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '12')
  await mkdir(day, { recursive: true })
  const fixtures = path.join(process.cwd(), 'mocks', 'cli', 'codex', 'fixtures', 'sessions')
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

test('excludes a subagent thread from the roster even though it holds assistant messages', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-subagent-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '14')
  await mkdir(day, { recursive: true })
  const sessionId = '01a09d44-306e-7b00-b7c7-0391bb2ae34f'
  await writeFile(
    path.join(day, `rollout-2026-09-14T01-14-46-${sessionId}.jsonl`),
    [
      {
        timestamp: '2026-09-14T00:14:46.946Z',
        type: 'session_meta',
        payload: {
          id: sessionId,
          thread_source: 'subagent',
          source: { subagent: { agent_nickname: 'Ptolemy' } },
        },
      },
      {
        timestamp: '2026-09-14T00:14:50.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          id: 'message-1',
          content: [{ type: 'output_text', text: 'Reviewed the spec.' }],
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )

  const result = listed(await listSessions(listing, root))
  assert.deepEqual(
    { found: result.filesFound, sessions: result.sessions },
    { found: 1, sessions: [] },
  )

  // Excluded from the roster, but a direct feed read by id must still come back clean rather
  // than surfacing the dropped assistant message or throwing.
  const feed = sessionFeedReplySchema.parse(
    await createSessionReader([codexSessionSource(root)]).readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId,
      delegationId: null,
      revision: null,
    }),
  )
  if (feed.type === 'session.feed.read') {
    assert.deepEqual(feed.rows, [])
  } else {
    assert.equal(feed.type, 'session.error')
  }
})
