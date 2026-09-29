import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionFeedReaderContext } from '../feed/feed-reader'
import { SessionEventJournal } from '../live/session-event-journal'
import { sessionFeedProcedures } from './session-feed'
import { SessionSyncStatusStore } from './session-sync-status'

const sessionId = '00000000-0000-4000-8000-000000000001'
let directory: string
let database: Database
let journal: SessionEventJournal

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'argo-session-feed-'))
  database = openDatabase(directory)
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'native-1' })
    .run()
  journal = new SessionEventJournal()
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

function message(id: string, role: 'user' | 'assistant', text: string): FeedContent {
  return { kind: 'message', id, role, text }
}

function command(id: string, text: string): FeedContent {
  return {
    kind: 'command',
    id,
    command: text,
    cwd: null,
    status: 'completed',
    output: null,
    stderr: null,
    exitCode: 0,
  }
}

function content(item: FeedContent): SessionLiveEventBody {
  return { type: 'content', commandId: null, turnId: null, vendorEventId: item.id, content: item }
}

const identity = { commandId: null, turnId: null, vendorEventId: null }

// Each read waits for the test to answer it, so a test can land events during a read.
function historyReads() {
  const pending: { resolve: (content: FeedContent[]) => void; reject: (error: Error) => void }[] =
    []
  return {
    pending,
    readHistory: () =>
      new Promise<FeedContent[]>((resolve, reject) => pending.push({ resolve, reject })),
    async answer(value: FeedContent[] | Error) {
      const read = pending.shift()
      if (read === undefined) throw new Error('No history read is waiting.')
      if (value instanceof Error) read.reject(value)
      else read.resolve(value)
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
  }
}

async function observe(
  context: Partial<SessionFeedReaderContext> & Pick<SessionFeedReaderContext, 'readHistory'>,
  observedId = sessionId,
) {
  const caller = initTRPC
    .create()
    .router(sessionFeedProcedures({ database, journal, hasLiveChannel: () => true, ...context }))
    .createCaller({})
  const readings: FeedReading[] = []
  const stream = await caller.sessionFeed({ sessionId: observedId })
  const subscription = stream.subscribe({ next: (reading) => readings.push(reading) })
  return { caller, readings, subscription, latest: () => readings.at(-1) }
}

// The trigger starts a second history read, and its answer replaces the first one's rows.
async function expectFreshRead(
  feed: Awaited<ReturnType<typeof observe>>,
  history: ReturnType<typeof historyReads>,
  trigger: () => void,
) {
  await history.answer([message('m1', 'assistant', 'Before')])
  trigger()
  await history.answer([message('m1', 'assistant', 'After')])
  expect(feed.latest()?.entries[0]?.row).toMatchObject({ text: 'After' })
  feed.subscription.unsubscribe()
}

const rowIds = (reading: FeedReading | undefined) => reading?.entries.map(({ row }) => row.id)

test('opens loading, then publishes the history rows in order', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  expect(feed.latest()).toMatchObject({ state: 'loading', error: null, entries: [] })
  await history.answer([message('m1', 'user', 'Hi'), message('m2', 'assistant', 'Hello')])
  expect(feed.latest()).toMatchObject({ sessionId, chainId: sessionId, state: 'ready' })
  expect(rowIds(feed.latest())).toEqual(['m1', 'm2'])
  feed.subscription.unsubscribe()
})

test('an event during the first read is kept and reconciled with history once', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  journal.append(sessionId, content(message('m2', 'assistant', 'Hello')))
  journal.append(sessionId, content(message('m3', 'assistant', 'Still going')))
  expect(rowIds(feed.latest())).toEqual(['m2', 'm3'])
  await history.answer([message('m1', 'user', 'Hi'), message('m2', 'assistant', 'Hello')])
  expect(rowIds(feed.latest())).toEqual(['m1', 'm2', 'm3'])
  feed.subscription.unsubscribe()
})

test('settled commands arrive grouped, with stable ids and revisions', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([command('c1', 'bun test'), command('c2', 'bun run typecheck')])
  const [group] = feed.latest()?.entries ?? []
  expect(group?.row).toMatchObject({ shape: 'tool-group', label: 'Ran 2 commands' })
  await feed.caller.sessionFeedRefresh({ sessionId })
  await history.answer([command('c1', 'bun test'), command('c2', 'bun run typecheck')])
  // The same history reads to the same reading, so nothing is published again.
  expect(feed.readings.filter(({ state }) => state === 'ready')).toHaveLength(1)
  feed.subscription.unsubscribe()
})

test('a failed Refresh keeps the known rows and a later Refresh recovers', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([message('m1', 'assistant', 'Read before the flake.')])
  await expect(feed.caller.sessionFeedRefresh({ sessionId })).resolves.toEqual({ accepted: true })
  await history.answer(new Error('Vendor history is unavailable.'))
  expect(feed.latest()).toMatchObject({
    state: 'failed',
    error: { code: 'vendor-history-unavailable' },
  })
  expect(rowIds(feed.latest())).toEqual(['m1'])
  await feed.caller.sessionFeedRefresh({ sessionId })
  expect(feed.latest()).toMatchObject({ state: 'loading', entries: [{ row: { id: 'm1' } }] })
  await history.answer([message('m1', 'assistant', 'Read before the flake.')])
  expect(feed.latest()).toMatchObject({ state: 'ready', error: null })
  feed.subscription.unsubscribe()
})

test('an expired replay starts from a fresh history read, not the partial journal', async () => {
  journal = new SessionEventJournal(2)
  for (const id of ['m1', 'm2', 'm3'])
    journal.append(sessionId, content(message(id, 'assistant', id)))
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  // m3 is still in the journal, but the replay lost m1, so none of it joins the reading.
  expect(rowIds(feed.latest())).toEqual([])
  expect(history.pending).toHaveLength(1)
  await history.answer([message('m1', 'assistant', 'm1'), message('m2', 'assistant', 'm2')])
  expect(rowIds(feed.latest())).toEqual(['m1', 'm2'])
  feed.subscription.unsubscribe()
})

test('a retained replay joins the first reading', async () => {
  journal.append(sessionId, content(message('m1', 'assistant', 'Live before open')))
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  expect(rowIds(feed.latest())).toEqual(['m1'])
  feed.subscription.unsubscribe()
})

test('a settled Turn reads vendor history again', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([])
  journal.append(sessionId, { type: 'status', ...identity, status: 'running' })
  expect(feed.latest()?.liveStatus).toBe('running')
  expect(history.pending).toHaveLength(0)
  journal.append(sessionId, { type: 'status', ...identity, status: 'idle' })
  expect(history.pending).toHaveLength(1)
  await history.answer([message('m1', 'assistant', 'Done')])
  expect(feed.latest()).toMatchObject({ state: 'ready', liveStatus: 'idle' })
  expect(rowIds(feed.latest())).toContain('m1')
  feed.subscription.unsubscribe()
})

test('names the waiting Question and Permission', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([])
  journal.append(sessionId, {
    type: 'permission',
    ...identity,
    requestId: 'permission-1',
    description: 'Run bun test',
    decision: null,
  })
  expect(feed.latest()?.pendingPermissionId).toBe('permission-1')
  journal.append(sessionId, {
    type: 'question',
    ...identity,
    requestId: 'question-1',
    questions: [
      {
        question: 'Which one?',
        header: 'Pick',
        multiSelect: false,
        options: [{ label: 'A', description: null }],
      },
    ],
    answer: null,
  })
  expect(feed.latest()?.pendingQuestionId).toBe('question-1')
  journal.append(sessionId, {
    type: 'permission',
    ...identity,
    requestId: 'permission-1',
    description: 'Run bun test',
    decision: 'allow',
  })
  expect(feed.latest()?.pendingPermissionId).toBeNull()
  feed.subscription.unsubscribe()
})

test('a Session Argo does not know reads as missing', async () => {
  const feed = await observe(
    { readHistory: async () => [] },
    '00000000-0000-4000-8000-000000000009',
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(feed.latest()).toMatchObject({ state: 'failed', error: { code: 'missing-session' } })
  feed.subscription.unsubscribe()
})

test('observers share one reader, and Refresh reaches only an observed Feed', async () => {
  const history = historyReads()
  const first = await observe({ readHistory: history.readHistory })
  await expect(first.caller.sessionFeedRefresh({ sessionId })).resolves.toEqual({ accepted: true })
  first.subscription.unsubscribe()
  await expect(first.caller.sessionFeedRefresh({ sessionId })).resolves.toEqual({
    accepted: false,
  })
})

test('an external Session reads history again when its file is rewritten', async () => {
  const history = historyReads()
  let rewrite = () => {}
  const feed = await observe({
    readHistory: history.readHistory,
    hasLiveChannel: () => false,
    followHistory: (_followed, invalidate) => {
      rewrite = invalidate
      return () => {}
    },
  })
  await expectFreshRead(feed, history, () => rewrite())
})

test('a committed sync reads vendor history again', async () => {
  const history = historyReads()
  const store = new SessionSyncStatusStore(undefined, 'claude')
  const feed = await observe({ readHistory: history.readHistory, sessionSyncStatus: [store] })
  await expectFreshRead(feed, history, () => store.committed())
})

test('a read that lands after the last observer left publishes nothing', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  feed.subscription.unsubscribe()
  await history.answer([message('m1', 'assistant', 'Late')])
  expect(feed.readings.map(({ state }) => state)).toEqual(['loading'])
})

test('the waiting Permission is the newest undecided one, not the newest event', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([])
  const permission = (requestId: string, decision: 'allow' | 'deny' | null) =>
    journal.append(sessionId, {
      type: 'permission',
      ...identity,
      requestId,
      description: requestId,
      decision,
    })
  permission('a', null)
  permission('b', null)
  permission('a', 'allow')
  expect(feed.latest()?.pendingPermissionId).toBe('b')
  permission('b', 'deny')
  expect(feed.latest()?.pendingPermissionId).toBeNull()
  feed.subscription.unsubscribe()
})

test('a Session that loses its live channel starts following its history file', async () => {
  const history = historyReads()
  let live = true
  const followed: string[] = []
  const feed = await observe({
    readHistory: history.readHistory,
    hasLiveChannel: () => live,
    followHistory: ({ target }) => {
      followed.push(target.nativeId)
      return () => {}
    },
  })
  await history.answer([])
  expect(followed).toEqual([])
  live = false
  journal.append(sessionId, { type: 'status', ...identity, status: 'ended' })
  expect(followed).toEqual(['native-1'])
  feed.subscription.unsubscribe()
})

test('a Session missing at open follows its history once a Refresh finds it', async () => {
  const otherId = '00000000-0000-4000-8000-000000000002'
  const history = historyReads()
  const followed: string[] = []
  const feed = await observe(
    {
      readHistory: history.readHistory,
      hasLiveChannel: () => false,
      followHistory: ({ target }) => {
        followed.push(target.nativeId)
        return () => {}
      },
    },
    otherId,
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(feed.latest()).toMatchObject({ state: 'failed', error: { code: 'missing-session' } })
  database
    .insert(sessionTable)
    .values({ argoId: otherId, harness: 'claude', nativeId: 'native-2' })
    .run()
  await feed.caller.sessionFeedRefresh({ sessionId: otherId })
  await history.answer([message('m1', 'assistant', 'Found')])
  expect(feed.latest()).toMatchObject({ state: 'ready', error: null })
  expect(followed).toEqual(['native-2'])
  feed.subscription.unsubscribe()
})
