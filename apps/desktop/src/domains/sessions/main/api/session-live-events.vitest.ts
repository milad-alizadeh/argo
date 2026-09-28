import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { SessionEventJournal } from '../live/session-event-journal'
import { sessionLiveEventsProcedure } from './session-live-events'

const sessionId = '00000000-0000-4000-8000-000000000001'
let directory: string
let database: Database
let journal: SessionEventJournal

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-live-subscription-'))
  database = openDatabase(directory)
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'native-1' })
    .run()
  journal = new SessionEventJournal(2)
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

async function subscribe(cursor: number, live = true, generation: string | null = null) {
  const t = initTRPC.create()
  const caller = t
    .router({ live: sessionLiveEventsProcedure({ database, journal, hasLiveChannel: () => live }) })
    .createCaller({})
  const updates: unknown[] = []
  const stream = await caller.live({ sessionId, cursor, generation })
  const subscription = stream.subscribe({ next: (update) => updates.push(update) })
  return { updates, subscription }
}

test('replays a cursor then delivers new live events through the product subscription', async () => {
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })
  const { updates, subscription } = await subscribe(0)
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'idle',
  })
  subscription.unsubscribe()
  expect(updates).toMatchObject([
    { type: 'ready', live: true, cursor: 1 },
    { type: 'event', event: { sessionId, sequence: 1, status: 'running' } },
    { type: 'event', event: { sessionId, sequence: 2, status: 'idle' } },
  ])
})

test('does not replay unanswered interactions after their live channel closes', async () => {
  journal.append(sessionId, {
    type: 'permission',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    requestId: 'permission-1',
    description: 'Read file',
    decision: null,
  })
  journal.append(sessionId, {
    type: 'question',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    requestId: 'question-1',
    questions: [{ question: 'Which file?', header: null, multiSelect: false, options: [] }],
    answer: null,
  })
  const external = await subscribe(0, false)
  external.subscription.unsubscribe()
  expect(external.updates).toEqual([
    {
      type: 'ready',
      live: false,
      cursor: 2,
      generation: journal.generation,
      replayExpired: false,
    },
  ])

  const live = await subscribe(0, true)
  live.subscription.unsubscribe()
  expect(live.updates).toMatchObject([
    { type: 'ready', live: true, cursor: 2 },
    { type: 'event', event: { type: 'permission', requestId: 'permission-1' } },
    { type: 'event', event: { type: 'question', requestId: 'question-1', answer: null } },
  ])
})

test('asks the reader to reconcile an expired cursor with vendor history', async () => {
  for (let index = 0; index < 3; index += 1)
    journal.append(sessionId, {
      type: 'status',
      commandId: null,
      turnId: null,
      vendorEventId: null,
      status: 'running',
    })
  const { updates, subscription } = await subscribe(0, false)
  subscription.unsubscribe()
  expect(updates).toEqual([
    {
      type: 'ready',
      live: false,
      cursor: 3,
      generation: journal.generation,
      replayExpired: true,
    },
    { type: 'expired', cursor: 3 },
  ])
})

test('does not lose an event published while replay is delivered', async () => {
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })
  const t = initTRPC.create()
  const caller = t
    .router({ live: sessionLiveEventsProcedure({ database, journal, hasLiveChannel: () => true }) })
    .createCaller({})
  const updates: unknown[] = []
  const stream = await caller.live({ sessionId, cursor: 0 })
  const subscription = stream.subscribe({
    next(update) {
      updates.push(update)
      if (update.type === 'ready')
        journal.append(sessionId, {
          type: 'status',
          commandId: null,
          turnId: null,
          vendorEventId: null,
          status: 'idle',
        })
    },
  })
  subscription.unsubscribe()
  expect(updates).toMatchObject([
    { type: 'ready', cursor: 1 },
    { type: 'event', event: { sequence: 1, status: 'running' } },
    { type: 'event', event: { sequence: 2, status: 'idle' } },
  ])
})

test('keeps queued replay events ahead of events published during queue delivery', async () => {
  const status = (value: 'running' | 'idle') => ({
    type: 'status' as const,
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: value,
  })
  journal.append(sessionId, status('running'))
  const t = initTRPC.create()
  const caller = t
    .router({ live: sessionLiveEventsProcedure({ database, journal, hasLiveChannel: () => true }) })
    .createCaller({})
  const sequences: number[] = []
  const stream = await caller.live({ sessionId, cursor: 0 })
  const subscription = stream.subscribe({
    next(update) {
      if (update.type === 'ready') {
        journal.append(sessionId, status('idle'))
        journal.append(sessionId, status('running'))
      }
      if (update.type !== 'event') return
      sequences.push(update.event.sequence)
      if (update.event.sequence === 2) journal.append(sessionId, status('idle'))
    },
  })
  subscription.unsubscribe()
  expect(sequences).toEqual([1, 2, 3, 4])
})

test.each([false, true])('invalidates vendor history with live channel %s', async (live) => {
  const t = initTRPC.create()
  const watcher: { invalidate: () => void; closed: boolean } = {
    invalidate: () => {
      throw new Error('Watcher did not attach.')
    },
    closed: false,
  }
  const caller = t
    .router({
      live: sessionLiveEventsProcedure({
        database,
        journal,
        hasLiveChannel: () => live,
        watchHistory: (harness, target, callback) => {
          expect(harness).toBe('claude')
          expect(target.nativeId).toBe('native-1')
          watcher.invalidate = callback
          return () => {
            watcher.closed = true
          }
        },
      }),
    })
    .createCaller({})
  const updates: unknown[] = []
  const stream = await caller.live({ sessionId, cursor: 0 })
  const subscription = stream.subscribe({ next: (update) => updates.push(update) })
  watcher.invalidate()
  subscription.unsubscribe()
  expect(updates).toMatchObject([{ type: 'ready', live }, { type: 'invalidated' }])
  expect(watcher.closed).toBe(true)
})

test('subscribes to Subagent changes without replaying root Session events', async () => {
  const t = initTRPC.create()
  const watcher: { invalidate: () => void } = {
    invalidate: () => {
      throw new Error('Subagent watcher did not attach.')
    },
  }
  const caller = t
    .router({
      live: sessionLiveEventsProcedure({
        database,
        journal,
        hasLiveChannel: () => true,
        watchHistory: (_harness, target, callback) => {
          expect(target.subagentId).toBe('subagent-1')
          watcher.invalidate = callback
          return () => {}
        },
      }),
    })
    .createCaller({})
  const updates: unknown[] = []
  const stream = await caller.live({ sessionId, subagentId: 'subagent-1', cursor: 0 })
  const subscription = stream.subscribe({ next: (update) => updates.push(update) })
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })
  watcher.invalidate()
  subscription.unsubscribe()
  expect(updates).toEqual([
    {
      type: 'ready',
      live: false,
      cursor: 0,
      generation: journal.generation,
      replayExpired: false,
    },
    { type: 'invalidated' },
  ])
})

test('expires a cursor from an earlier process even when its sequence matches', async () => {
  const previous = new SessionEventJournal()
  previous.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'idle',
  })
  const { updates, subscription } = await subscribe(1, false, previous.generation)
  subscription.unsubscribe()
  expect(updates).toMatchObject([
    { type: 'ready', cursor: 1, generation: journal.generation, replayExpired: true },
    { type: 'expired', cursor: 1 },
  ])
})
