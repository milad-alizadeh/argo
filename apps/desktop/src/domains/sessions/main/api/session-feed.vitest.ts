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
import { SessionActivities } from './session-activities'
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
  subagentId: string | null = null,
) {
  const caller = initTRPC
    .create()
    .router(sessionFeedProcedures({ database, journal, hasLiveChannel: () => true, ...context }))
    .createCaller({})
  const readings: FeedReading[] = []
  const stream = await caller.sessionFeed({ sessionId: observedId, subagentId })
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

test('a multi-activity Turn publishes its latest activity to the Feed and the roster', async () => {
  let rosterChanges = 0
  const activities = new SessionActivities(() => {
    rosterChanges += 1
  })
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory, activities })
  await history.answer([message('m1', 'user', 'Check it'), command('c1', 'bun test')])
  const first = { kind: 'command', label: 'Ran bun test', open: false }
  expect(activityOf(feed.latest())).toMatchObject({ activity: first })
  expect(activities.activityOf(sessionId)).toMatchObject(first)

  journal.append(sessionId, content(reasoning('r1', null)))
  journal.append(sessionId, content(reasoning('r2', 'Reading **the** failure')))
  const thought = { kind: 'thought', label: 'Reading **the** failure', open: true }
  expect(activityOf(feed.latest())).toMatchObject({ activity: thought })
  // Unreadable reasoning is dropped: no tile, and no text made up for it.
  expect(rowIds(feed.latest())).not.toContain('r1')

  journal.append(sessionId, content(running('c2', 'bun run typecheck')))
  const latest = { kind: 'command', label: 'Ran bun run typecheck', open: true }
  expect(activityOf(feed.latest())).toMatchObject({ activity: latest })
  expect(activities.activityOf(sessionId)).toMatchObject(latest)
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
  expect(activities.activityOf(sessionId)).toBeNull()
  expect(rosterChanges).toBe(changesBeforeClose + 1)
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

// A second observer on the same router, so both share its readers.
async function also(feed: Awaited<ReturnType<typeof observe>>, subagentId: string) {
  const readings: FeedReading[] = []
  const stream = await feed.caller.sessionFeed({ sessionId, subagentId })
  const subscription = stream.subscribe({ next: (reading) => readings.push(reading) })
  return { readings, subscription, latest: () => readings.at(-1) }
}

function delegation(
  id: string,
  event: 'started' | 'messaged' | 'responded',
  facts: { status?: 'completed' | 'failed'; prompt?: string; summary?: string } = {},
): FeedContent {
  return {
    kind: 'delegation',
    id,
    event,
    agentId: 'agent-1',
    status: facts.status ?? 'running',
    name: 'Survey adapters',
    prompt: facts.prompt ?? null,
    model: null,
    summary: facts.summary ?? null,
  }
}

// Reads answer by chain, so a parent and its Subagent can each be answered in turn.
function chainReads() {
  const reads = new Map<string, ReturnType<typeof historyReads>>()
  const chain = (subagentId: string | null) => {
    const key = subagentId ?? 'root'
    const existing = reads.get(key)
    if (existing !== undefined) return existing
    const created = historyReads()
    reads.set(key, created)
    return created
  }
  return {
    chain,
    readHistory: (_harness: unknown, target: { subagentId: string | null }) =>
      chain(target.subagentId).readHistory(),
  }
}

test('a Subagent chain reads its own history through the same Observe and Refresh', async () => {
  const reads = chainReads()
  const child = await observe({ readHistory: reads.readHistory }, sessionId, 'agent-1')
  await reads.chain(null).answer([delegation('call-1', 'started')])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Reading the adapters')])
  expect(child.latest()).toMatchObject({ sessionId, chainId: 'agent-1', state: 'ready' })
  expect(rowIds(child.latest())).toEqual(['c1'])
  await expect(
    child.caller.sessionFeedRefresh({ sessionId, subagentId: 'agent-1' }),
  ).resolves.toEqual({ accepted: true })
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Done reading')])
  expect(child.latest()?.entries[0]?.row).toMatchObject({ text: 'Done reading' })
  child.subscription.unsubscribe()
})

test('the parent lists its Subagents, and a response ends the Subagent Feed once', async () => {
  const reads = chainReads()
  const parent = await observe({ readHistory: reads.readHistory })
  const child = await also(parent, 'agent-1')
  const started = delegation('call-1', 'started', { prompt: 'Survey the adapters' })
  await reads.chain(null).answer([started])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Two adapters')])
  expect(parent.latest()?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey adapters', state: 'running' },
  ])
  expect(rowIds(child.latest())).toEqual(['c1'])

  // The parent's history now records the response; the child reads its settled transcript.
  await parent.caller.sessionFeedRefresh({ sessionId })
  const response = delegation('call-1:response', 'responded', {
    status: 'completed',
    summary: 'Two adapters',
  })
  await reads.chain(null).answer([started, response])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Two adapters')])
  expect(parent.latest()?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey adapters', state: 'completed' },
  ])
  expect(child.latest()?.entries.map(({ row }) => row)).toEqual([
    { shape: 'prose', id: 'c1', role: 'assistant', text: 'Two adapters' },
    {
      shape: 'subagent',
      id: 'call-1:response',
      subagentId: 'agent-1',
      event: 'responded',
      state: 'completed',
      name: 'Survey adapters',
    },
  ])
  // Another parent read with the same response publishes nothing new to the child.
  const before = child.readings.length
  await parent.caller.sessionFeedRefresh({ sessionId })
  await reads.chain(null).answer([started, response])
  expect(child.readings).toHaveLength(before)
  expect(parent.latest()?.entries.map(({ row }) => row.id)).toEqual(['call-1', 'call-1:response'])
  child.subscription.unsubscribe()
  parent.subscription.unsubscribe()
})

test('a failed Subagent ends its Feed as failed', async () => {
  const reads = chainReads()
  const child = await observe({ readHistory: reads.readHistory }, sessionId, 'agent-1')
  await reads
    .chain(null)
    .answer([
      delegation('call-1', 'started'),
      delegation('call-1:response', 'responded', { status: 'failed' }),
    ])
  await reads.chain('agent-1').answer([])
  expect(child.latest()?.entries.at(-1)?.row).toMatchObject({
    shape: 'subagent',
    event: 'responded',
    state: 'failed',
  })
  child.subscription.unsubscribe()
})

test('a live Subagent event reconciles with the parent history once', async () => {
  const reads = chainReads()
  const parent = await observe({ readHistory: reads.readHistory })
  const started = delegation('call-1', 'started')
  const messaged = delegation('call-1:message', 'messaged', { prompt: 'Also tests' })
  journal.append(sessionId, content(started))
  journal.append(sessionId, content(messaged))
  await reads.chain(null).answer([started])
  expect(rowIds(parent.latest())).toEqual(['call-1', 'call-1:message'])
  parent.subscription.unsubscribe()
})

test('a Subagent follows its own history file even while the parent is live', async () => {
  const reads = chainReads()
  const followed: (string | null)[] = []
  const child = await observe(
    {
      readHistory: reads.readHistory,
      followHistory: (target) => {
        followed.push(target.target.subagentId)
        return () => {}
      },
    },
    sessionId,
    'agent-1',
  )
  expect(followed).toEqual(['agent-1'])
  child.subscription.unsubscribe()
})
