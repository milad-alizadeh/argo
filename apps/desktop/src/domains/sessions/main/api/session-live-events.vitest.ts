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

async function subscribe(cursor: number, live = true) {
  const t = initTRPC.create()
  const caller = t
    .router({ live: sessionLiveEventsProcedure({ database, journal, hasLiveChannel: () => live }) })
    .createCaller({})
  const updates: unknown[] = []
  const stream = await caller.live({ sessionId, cursor })
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
    { type: 'ready', live: false, cursor: 3 },
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
