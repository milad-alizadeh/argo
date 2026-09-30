// The shared harness for the Feed reader's tRPC tests: one temporary database and journal per
// test, history reads a test answers by hand, and an observer that collects published readings.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initTRPC } from '@trpc/server'
import type { Observable } from '@trpc/server/observable'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import {
  applyFeedReadingChange,
  type FeedReading,
  type FeedReadingMessage,
} from '@/domains/sessions/api/feed'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { type SessionFeedReaderContext, SessionFeedReaders } from '../feed'
import { SessionEventJournal } from '../live'
import { sessionFeedProcedures } from './session-feed'
import { SessionListChanges } from './session-list-changes'

export const sessionId = '00000000-0000-4000-8000-000000000001'

// Written by `registerFeedDatabase`, which every test file registers before it reads them.
export let database: Database
export let journal: SessionEventJournal

// Registers the per-test database and journal. Each test file calls it once, at its top.
export function registerFeedDatabase() {
  let directory: string
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
    vi.useRealTimers()
    database.$client.close()
    await rm(directory, { recursive: true, force: true })
  })
}

// A test that needs a different replay window swaps the journal in before it observes.
export function replaceJournal(replacement: SessionEventJournal) {
  journal = replacement
  return replacement
}

export function message(id: string, role: 'user' | 'assistant', text: string): FeedContent {
  return { kind: 'message', id, role, text }
}

export function command(id: string, text: string): FeedContent {
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

export function content(item: FeedContent): SessionLiveEventBody {
  return { type: 'content', commandId: null, turnId: null, vendorEventId: item.id, content: item }
}

export const identity = { commandId: null, turnId: null, vendorEventId: null }

// Each read waits for the test to answer it, so a test can land events during a read.
export function historyReads() {
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
      await new Promise((resolve) => setImmediate(resolve))
    },
  }
}

export async function observe(
  context: Partial<SessionFeedReaderContext> & Pick<SessionFeedReaderContext, 'readHistory'>,
  observedId = sessionId,
  subagentId: string | null = null,
) {
  const caller = initTRPC
    .create()
    .router(
      sessionFeedProcedures(
        new SessionFeedReaders({
          database,
          journal,
          hasLiveChannel: () => true,
          changes: new SessionListChanges(),
          ...context,
        }),
      ),
    )
    .createCaller({})
  const stream = await caller.sessionFeed({ sessionId: observedId, subagentId })
  return { caller, ...collect(stream) }
}

// Each message applied to the reading before it, as the renderer applies them.
export function collect(stream: Observable<FeedReadingMessage, unknown>) {
  const readings: FeedReading[] = []
  const messages: FeedReadingMessage[] = []
  const subscription = stream.subscribe({
    next: (message) => {
      messages.push(message)
      const reading = applyFeedReadingChange(readings.at(-1), message)
      if (reading === null) throw new Error('A change arrived against a reading never sent.')
      readings.push(reading)
    },
  })
  return { readings, messages, subscription, latest: () => readings.at(-1) }
}

// The trigger starts a second history read, and its answer replaces the first one's rows.
export async function expectFreshRead(
  feed: Awaited<ReturnType<typeof observe>>,
  history: ReturnType<typeof historyReads>,
  trigger: () => unknown,
) {
  await history.answer([message('m1', 'assistant', 'Before')])
  await trigger()
  await history.answer([message('m1', 'assistant', 'After')])
  expect(feed.latest()?.entries[0]?.row).toMatchObject({ text: 'After' })
  feed.subscription.unsubscribe()
}

export const rowIds = (reading: FeedReading | undefined) =>
  reading?.entries.map(({ row }) => row.id)

// Reads answer by chain, so a parent and its Subagent can each be answered in turn.
export function chainReads() {
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
