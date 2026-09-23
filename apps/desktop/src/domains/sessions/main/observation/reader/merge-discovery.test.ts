import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import { type SessionListReply, sessionError } from '@/domains/sessions/contract/ipc'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { markSessionRead, sessionRosterQueryKey } from '@/domains/sessions/renderer/session-queries'
import { createInMemorySessionUnreadStore } from '../../unread/unread-store'
import type { TranscriptDiscovery } from './discover-transcript-sessions'
import { combineDiscoveries, type Discovered } from './merge-discovery'

function readingOf(overrides: Partial<TranscriptDiscovery> = {}): Discovered {
  return {
    rows: [],
    filesFound: 0,
    filesRead: 0,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor: null,
    historyComplete: true,
    ...overrides,
  }
}

async function assertUnreadFollowsRetiredIds(session: TranscriptDiscovery['rows'][number]) {
  const unread = createInMemorySessionUnreadStore()
  const retired = { id: 'retired', retiredIds: [], status: 'idle' as const, updatedAt: null }
  await unread.project([retired])
  await unread.setUnread([retired], true)
  assert.equal((await unread.project([session]))[0]?.unread, true)
  await unread.focus(session)
  assert.equal((await unread.project([session]))[0]?.unread, false)
}

function assertOpeningKeepsRow(
  reply: Extract<SessionListReply, { type: 'session.listed' }>,
  session: TranscriptDiscovery['rows'][number],
) {
  const queryClient = new QueryClient()
  queryClient.setQueryData([...sessionRosterQueryKey, null], {
    pages: [
      {
        sessions: reply.sessions.map((row) => ({ ...row, unread: true })),
        filesFound: reply.filesFound,
        filesRead: reply.filesRead,
        filesUnreadable: reply.filesUnreadable,
        filesParsed: reply.filesParsed,
        nextCursor: reply.nextCursor,
        historyComplete: reply.historyComplete,
        partialFailures: reply.partialFailures,
      },
    ],
    pageParams: [null],
  })
  markSessionRead(queryClient, session.id, session.retiredIds)
  const opened = queryClient.getQueryData<{ pages: { sessions: (typeof session)[] }[] }>([
    ...sessionRosterQueryKey,
    null,
  ])
  assert.equal(
    opened?.pages[0]?.sessions.some(({ id }) => id === session.id),
    true,
  )
  assert.equal(opened?.pages[0]?.sessions.find(({ id }) => id === session.id)?.unread, false)
}

test('names the failing source in a reply built from the other, healthy one (#2653 follow-up)', () => {
  const reply = combineDiscoveries(
    [readingOf(), { error: sessionError('vendor-history-unavailable', 'req-1') }],
    ['claude', 'codex'],
    'req-1',
  )

  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(reply.type === 'session.listed' ? reply.partialFailures : null, [
    { harness: 'codex', code: 'vendor-history-unavailable' },
  ])
})

test('carries no partial failure when every source answers', () => {
  const reply = combineDiscoveries([readingOf(), readingOf()], ['claude', 'codex'], 'req-1')

  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(reply.type === 'session.listed' ? reply.partialFailures : null, [])
})

test('keeps roster invariants across discovery batches and opening a resumed Session', async () => {
  for (let batchSize = 1; batchSize <= 12; batchSize += 1) {
    const rows = Array.from({ length: batchSize }, (_, index) =>
      rosterRow({
        id: `session-${index % Math.max(1, Math.ceil(batchSize / 2))}`,
        updatedAt: `2026-09-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        title:
          index % 2 === 0
            ? { text: `Prompt ${index}`, source: 'first-prompt' }
            : { text: `Summary ${index}`, source: 'summarised' },
      }),
    )
    rows.push(rosterRow({ id: 'resumed', retiredIds: ['retired'] }))
    const reply = combineDiscoveries(
      [readingOf({ rows }), readingOf({ rows: [...rows].reverse() })],
      ['claude', 'codex'],
      `req-${batchSize}`,
    )

    assert.equal(reply.type, 'session.listed')
    if (reply.type !== 'session.listed') continue
    assert.equal(new Set(reply.sessions.map(({ id }) => id)).size, reply.sessions.length)
    assert.ok(
      reply.sessions.every(({ updatedAt }) => updatedAt === null || !updatedAt.startsWith('1970-')),
    )
    assert.ok(
      reply.sessions.every(
        ({ title }) =>
          title === null || ['custom', 'summarised', 'first-prompt'].includes(title.source),
      ),
    )

    const resumed = reply.sessions.find(({ id }) => id === 'resumed')
    assert.ok(resumed)
    await assertUnreadFollowsRetiredIds(resumed)
    assertOpeningKeepsRow(reply, resumed)
  }
})
