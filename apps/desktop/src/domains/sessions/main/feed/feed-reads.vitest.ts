import { eq } from 'drizzle-orm'
import { expect, test } from 'vitest'
import { sessionCommandTable } from '@/database/session/command-schema'
import { sessionTable } from '@/database/session/schema'
import type { FeedReading } from '@/domains/sessions/api/feed'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import {
  database,
  journal,
  message,
  registerFeedDatabase,
  rowIds,
  sessionId,
} from '@/mocks/sessions/session-feed-harness'
import { SessionListChanges } from '../api'
import {
  bindSessionCommand,
  createSessionCommandStore,
  markUnresolvedSessionCommandsUnknown,
  reconcileUnknownSessionCommands,
} from '../database'
import { HISTORY_READ_SLOTS, HistoryReadLimit } from './history-read-limit'
import { SessionFeedReaders } from './index'

registerFeedDatabase()

const settled = () => new Promise((resolve) => setImmediate(resolve))

type Read = { nativeId: string; resolve: (content: FeedContent[]) => void }

// Vendor reads that wait for the test, counted as they start and end, behind one shared limit.
function vendor() {
  const limit = new HistoryReadLimit()
  const running: Read[] = []
  const started: string[] = []
  let peak = 0
  const read = (target: Pick<SessionHistoryTarget, 'nativeId'>) =>
    new Promise<FeedContent[]>((resolve) => {
      started.push(target.nativeId)
      const entry: Read = {
        nativeId: target.nativeId,
        resolve: (content) => {
          running.splice(running.indexOf(entry), 1)
          resolve(content)
        },
      }
      running.push(entry)
      peak = Math.max(peak, running.length)
    })
  return {
    limit,
    running,
    started,
    peak: () => peak,
    readHistory: (_harness: unknown, target: SessionHistoryTarget, signal: AbortSignal) =>
      limit.run(() => read(target), signal),
    readRecovery: (_harness: unknown, target: Pick<SessionHistoryTarget, 'nativeId'>) =>
      limit.run(() => read(target)),
    async answer(nativeId: string, content: FeedContent[]) {
      const entry = running.find((candidate) => candidate.nativeId === nativeId)
      if (entry === undefined) throw new Error(`No read of ${nativeId} is running.`)
      entry.resolve(content)
      await settled()
    },
  }
}

function readers(readHistory: ReturnType<typeof vendor>['readHistory']) {
  return new SessionFeedReaders({
    database,
    journal,
    hasLiveChannel: () => true,
    changes: new SessionListChanges(),
    readHistory,
  })
}

function addSessions(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const argoId = `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`
    database
      .insert(sessionTable)
      .values({ argoId, harness: 'claude', nativeId: `other-${index}` })
      .run()
    return argoId
  })
}

function watch(feeds: SessionFeedReaders, observedId: string) {
  const readings: FeedReading[] = []
  const stop = feeds.observe({ sessionId: observedId, subagentId: null }, (reading) =>
    readings.push(reading),
  )
  return { readings, stop, latest: () => readings.at(-1) }
}

test('rapid switching keeps reads within the shared limit and reads only the Feed left open', async () => {
  const reads = vendor()
  const feeds = readers(reads.readHistory)
  const ids = addSessions(8)
  let open = watch(feeds, ids[0] ?? '')
  for (const id of ids.slice(1)) {
    open.stop()
    open = watch(feeds, id)
  }
  await settled()
  // The first two hold their slots until they end; every Feed closed while waiting never reads.
  expect(reads.started).toEqual(['other-0', 'other-1'])
  await reads.answer('other-0', [message('m0', 'assistant', 'Closed')])
  expect(reads.started).toEqual(['other-0', 'other-1', 'other-7'])
  await reads.answer('other-1', [])
  await reads.answer('other-7', [message('m7', 'assistant', 'Shown')])
  expect(open.latest()).toMatchObject({ sessionId: ids[7], state: 'ready' })
  expect(rowIds(open.latest())).toEqual(['m7'])
  expect(reads.peak()).toBe(HISTORY_READ_SLOTS)
  open.stop()
})

test('writes to the open history during a read ask for one follow-up read, not one each', async () => {
  const reads = vendor()
  const feeds = readers(reads.readHistory)
  const feed = watch(feeds, sessionId)
  await settled()
  for (let write = 0; write < 5; write += 1) feeds.refresh({ sessionId, subagentId: null })
  expect(reads.started).toHaveLength(1)
  await reads.answer('native-1', [message('m1', 'user', 'Before')])
  expect(rowIds(feed.latest())).toEqual(['m1'])
  expect(reads.started).toHaveLength(2)
  await reads.answer('native-1', [message('m1', 'user', 'Before'), message('m2', 'user', 'After')])
  expect(rowIds(feed.latest())).toEqual(['m1', 'm2'])
  expect(reads.started).toHaveLength(2)
  feed.stop()
})

test('closing a Feed during its read drops the late result and frees the slot only when the read ends', async () => {
  const reads = vendor()
  const feeds = readers(reads.readHistory)
  const [other, third] = addSessions(2)
  const first = watch(feeds, sessionId)
  const second = watch(feeds, other ?? '')
  first.stop()
  const next = watch(feeds, third ?? '')
  await settled()
  expect(reads.started).toEqual(['native-1', 'other-0'])
  await reads.answer('native-1', [message('late', 'assistant', 'Late')])
  expect(first.readings.map(({ state }) => state)).toEqual(['loading'])
  expect(reads.started).toEqual(['native-1', 'other-0', 'other-1'])
  await reads.answer('other-1', [message('m3', 'assistant', 'Next')])
  expect(rowIds(next.latest())).toEqual(['m3'])
  second.stop()
  next.stop()
})

const recovered = {
  commandId: '00000000-0000-4000-8000-000000000201',
  nativeId: 'native-recovered',
  identity: { intentId: 'optimistic:draft-1:1', harness: 'claude', nativeId: null, cwd: '/repo' },
} as const

// Claiming the command again is what a resend would do first.
const claim = () =>
  createSessionCommandStore(database).reserve(recovered.commandId, null, recovered.identity)
    .reserved

test('uncertain-command recovery waits for a slot behind open Feeds, then settles without a resend', async () => {
  const reads = vendor()
  const feeds = readers(reads.readHistory)
  const [other] = addSessions(1)
  const first = watch(feeds, sessionId)
  const second = watch(feeds, other ?? '')
  expect(claim()).toBe(true)
  bindSessionCommand(database, recovered.commandId, { nativeId: recovered.nativeId })
  markUnresolvedSessionCommandsUnknown(database)
  const recovery = reconcileUnknownSessionCommands(database, reads.readRecovery, async () => false)
  await settled()
  expect(reads.started).toEqual(['native-1', 'other-0'])
  await reads.answer('native-1', [])
  expect(reads.started.at(-1)).toBe('native-recovered')
  await reads.answer('native-recovered', [message(recovered.commandId, 'user', 'Sent once')])
  await recovery
  const stored = database
    .select()
    .from(sessionCommandTable)
    .where(eq(sessionCommandTable.commandId, recovered.commandId))
    .get()
  expect(stored?.status).toBe('running')
  expect(claim()).toBe(false)
  first.stop()
  second.stop()
})
