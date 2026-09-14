import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionFeedReplySchema, sessionListReplySchema } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import { createCodexSessionReader } from './read-sessions'

const listing = { version: 1 as const, type: 'session.list' as const, requestId: 'list-1' }

function listed(
  reply: Awaited<ReturnType<ReturnType<typeof createCodexSessionReader>['listSessions']>>,
) {
  const parsed = sessionListReplySchema.parse(reply)
  if (parsed.type !== 'session.listed')
    throw new Error(`Expected sessions, received ${parsed.type}.`)
  return parsed
}

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
      delegationId: null,
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

test('a Codex Session Argo held before restart is orphaned and keeps its recorded Feed', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-orphaned-session-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a09cee-bb4c-7991-b10d-7c58aff5e0ff'
  await writeManagedRollout(root, sessionId)
  const reader = createCodexSessionReader(root, { orphans: () => new Set([sessionId]) })

  const roster = listed(await reader.listSessions(listing))
  assert.deepEqual(
    roster.sessions.map(({ id, posture }) => ({ id, posture })),
    [{ id: sessionId, posture: 'orphaned' }],
  )
  const feed = sessionFeedReplySchema.parse(
    await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId,
      delegationId: null,
      revision: null,
    }),
  )
  assert.equal(feed.type, 'session.feed.read')
})
