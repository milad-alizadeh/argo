import { eq } from 'drizzle-orm'
import { expect, test, vi } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { FEED_TEXT_COALESCE_MS } from '../feed/feed-reader'
import { SessionEventJournal } from '../live/session-event-journal'
import { storedActivity } from './session-activities'
import {
  command,
  content,
  database,
  expectFreshRead,
  historyReads,
  identity,
  journal,
  message,
  observe,
  registerFeedDatabase,
  replaceJournal,
  rowIds,
  sessionId,
} from './session-feed-harness'
import { SessionRosterChanges } from './session-roster-changes'
import { SessionSyncStatusStore } from './session-sync-status'

registerFeedDatabase()

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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  journal.append(sessionId, content(message('m2', 'assistant', 'Hello')))
  journal.append(sessionId, content(message('m3', 'assistant', 'Still going')))
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS)
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
  replaceJournal(new SessionEventJournal(2))
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

function running(id: string, text: string): FeedContent {
  return {
    kind: 'command',
    id,
    command: text,
    cwd: null,
    status: 'running',
    output: null,
    stderr: null,
    exitCode: null,
  }
}

function reasoning(id: string, text: string | null): FeedContent {
  return { kind: 'reasoning', id, text, redacted: text === null }
}

const activityOf = (reading: FeedReading | undefined) =>
  reading?.entries.find(({ row }) => row.shape === 'activity')?.row

const rosterActivity = () =>
  storedActivity(
    database
      .select({ activity: sessionTable.activity })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, sessionId))
      .get()?.activity ?? null,
  )

test('a multi-activity Turn publishes its latest activity to the Feed and keeps it for the roster', async () => {
  let rosterChanges = 0
  const roster = new SessionRosterChanges()
  roster.subscribe(() => {
    rosterChanges += 1
  })
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory, roster })
  await history.answer([message('m1', 'user', 'Check it'), command('c1', 'bun test')])
  const first = { kind: 'command', label: 'Ran bun test', open: false }
  expect(activityOf(feed.latest())).toMatchObject({ activity: first })
  expect(rosterActivity()).toMatchObject(first)

  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  journal.append(sessionId, content(reasoning('r1', null)))
  journal.append(sessionId, content(reasoning('r2', 'Reading **the** failure')))
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS)
  const thought = { kind: 'thought', label: 'Reading **the** failure', open: true }
  expect(activityOf(feed.latest())).toMatchObject({ activity: thought })
  // Unreadable reasoning is dropped: no tile, and no text made up for it.
  expect(rowIds(feed.latest())).not.toContain('r1')

  journal.append(sessionId, content(running('c2', 'bun run typecheck')))
  const latest = { kind: 'command', label: 'Ran bun run typecheck', open: true }
  expect(activityOf(feed.latest())).toMatchObject({ activity: latest })
  expect(rosterActivity()).toMatchObject(latest)
  expect(feed.latest()?.entries.filter(({ row }) => row.shape === 'activity')).toHaveLength(1)

  journal.append(sessionId, content(command('c2', 'bun run typecheck')))
  journal.append(sessionId, { type: 'status', ...identity, status: 'idle' })
  await history.answer([
    message('m1', 'user', 'Check it'),
    command('c1', 'bun test'),
    reasoning('r2', 'Reading **the** failure'),
    command('c2', 'bun run typecheck'),
    message('m2', 'assistant', 'Both pass.'),
  ])
  expect(activityOf(feed.latest())).toMatchObject({ activity: { ...latest, open: false } })
  const changesBeforeClose = rosterChanges
  feed.subscription.unsubscribe()
  expect(rosterActivity()).toMatchObject({ ...latest, open: false })
  expect(rosterChanges).toBe(changesBeforeClose)
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

// One streamed reply: each snapshot carries the whole text so far under one message id.
function stream(words: number) {
  for (let count = 1; count <= words; count += 1)
    journal.append(
      sessionId,
      content(message('m2', 'assistant', Array.from({ length: count }, () => 'word').join(' '))),
    )
}

test('streamed text publishes one reading per window, with the latest text', async () => {
  const history = historyReads()
  let reads = 0
  const feed = await observe({
    readHistory: () => {
      reads += 1
      return history.readHistory()
    },
  })
  await history.answer([message('m1', 'user', 'Go')])
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const before = feed.readings.length
  stream(20)
  expect(feed.readings).toHaveLength(before)
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS)
  expect(feed.readings).toHaveLength(before + 1)
  expect(feed.latest()?.entries[1]?.row).toMatchObject({ text: Array(20).fill('word').join(' ') })
  stream(3)
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS * 5)
  expect(feed.readings).toHaveLength(before + 2)
  // Each change carries the streamed row alone, not the prompt before it.
  expect(feed.messages.at(-1)).toMatchObject({ kept: 1, tail: [{ row: { id: 'm2' } }] })
  expect(reads).toBe(1)
  feed.subscription.unsubscribe()
})

test('a Question or Permission publishes at once, with the text still waiting', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([])
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  stream(2)
  journal.append(sessionId, {
    type: 'permission',
    ...identity,
    requestId: 'permission-1',
    description: 'Run bun test',
    decision: null,
  })
  expect(feed.latest()?.pendingPermissionId).toBe('permission-1')
  expect(feed.latest()?.entries[0]?.row).toMatchObject({ id: 'm2', text: 'word word' })
  const published = feed.readings.length
  // The text went out with the Permission, so its window has nothing left to publish.
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS)
  expect(feed.readings).toHaveLength(published)
  feed.subscription.unsubscribe()
})

test('text still waiting when the last observer leaves publishes nothing', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer([])
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const before = feed.readings.length
  stream(2)
  feed.subscription.unsubscribe()
  await vi.advanceTimersByTimeAsync(FEED_TEXT_COALESCE_MS)
  expect(feed.readings).toHaveLength(before)
  expect(vi.getTimerCount()).toBe(0)
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
  await expectFreshRead(feed, history, () => store.committed([sessionId]))
})

test('a committed sync that names another Session reads nothing again', async () => {
  const history = historyReads()
  const store = new SessionSyncStatusStore(undefined, 'claude')
  const feed = await observe({ readHistory: history.readHistory, sessionSyncStatus: [store] })
  await history.answer([message('m1', 'assistant', 'Before')])
  store.committed(['00000000-0000-4000-8000-000000000099'])
  expect(history.pending).toHaveLength(0)
  feed.subscription.unsubscribe()
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
