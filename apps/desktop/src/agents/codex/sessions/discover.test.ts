import assert from 'node:assert/strict'
import { appendFile, copyFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { sessionFeedReplySchema, sessionListReplySchema } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import { createCodexSessionReader } from './read-sessions'

const listing = { version: 1 as const, type: 'session.list' as const, requestId: 'list-1' }

function listSessions(value: unknown, root: string) {
  return createCodexSessionReader(root).listSessions(value as never)
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

async function writeManagedRollout(root: string, sessionId: string) {
  const day = path.join(root, '2026', '09', '13')
  await mkdir(day, { recursive: true })
  const file = path.join(day, `rollout-2026-09-13T15-17-11-${sessionId}.jsonl`)
  await writeFile(
    file,
    [
      {
        timestamp: '2026-09-13T15:17:11.000Z',
        type: 'session_meta',
        payload: { id: sessionId },
      },
      {
        timestamp: '2026-09-13T15:17:12.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'Inspect the failing test.' },
      },
      {
        timestamp: '2026-09-13T15:17:14.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          id: 'message-1',
          content: [{ type: 'output_text', text: 'The test is fixed.' }],
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )
}

test('joins a timestamped rollout to its managed Session and reads its Feed under that ID', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-managed-session-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a09cee-bb4c-7991-b10d-7c58aff5e0ff'
  await writeManagedRollout(root, sessionId)
  const reader = createCodexSessionReader(root, {
    roster: () => [
      managedRow(sessionId, {
        cli: 'codex',
        status: 'running',
        cwd: '/projects/argo',
        prompt: 'Inspect the failing test.',
        startedAt: '2026-09-13T15:17:11.000Z',
        setup: { model: null, effort: null, mode: null },
      }),
    ],
  })

  const roster = listed(await reader.listSessions(listing))
  assert.deepEqual(
    roster.sessions.map(({ id, posture, status }) => ({ id, posture, status })),
    [{ id: sessionId, posture: 'managed', status: 'running' }],
  )
  const feed = sessionFeedReplySchema.parse(
    await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId,
      revision: null,
    }),
  )
  assert.equal(feed.type, 'session.feed.read')
  if (feed.type !== 'session.feed.read') return
  assert.equal(feed.chainId, sessionId)
  assert.deepEqual(
    feed.rows.filter((row) => row.shape === 'prose').map(({ text }) => text),
    ['Inspect the failing test.', 'The test is fixed.'],
  )
})
