import { expect, test, vi } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import { sessionSubagent } from '@/database/session-subagent/schema'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { SessionListChanges } from '../api'
import { recordLiveSessionEvents, watchIdleSession } from './live-session-supervisor-machine'
import { SessionEventJournal } from './session-event-journal'

const sessionId = '00000000-0000-4000-8000-000000000001'

function message(id: string, text = id): SessionLiveEventBody {
  return {
    type: 'content',
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: id,
    content: { id, kind: 'message', role: 'assistant', text },
  }
}

function liveSession() {
  const snapshots = new Set<(snapshot: unknown) => void>()
  const events = new Set<(event: { type: 'feed'; body: SessionLiveEventBody }) => void>()
  let argoId: string | null = null
  let state = 'Ready'
  const snapshot = () => ({
    context: { argoId, first: { commandId: 'command-1' }, queue: [] },
    matches: (value: string) => state === value,
  })
  const actor = {
    getSnapshot: snapshot,
    on(_type: 'feed', listener: (event: { type: 'feed'; body: SessionLiveEventBody }) => void) {
      events.add(listener)
      return { unsubscribe: () => events.delete(listener) }
    },
    subscribe(listener: (snapshot: unknown) => void) {
      snapshots.add(listener)
      return { unsubscribe: () => snapshots.delete(listener) }
    },
  } as unknown as Parameters<typeof recordLiveSessionEvents>[0]
  return {
    actor,
    feed: (body: SessionLiveEventBody) => {
      for (const listener of events) listener({ type: 'feed', body })
    },
    identify: (id: string) => {
      argoId = id
      for (const listener of snapshots) listener(snapshot())
    },
    state: (value: string) => {
      state = value
      for (const listener of snapshots) listener(snapshot())
    },
    listeners: () => snapshots.size + events.size,
  }
}

test('retires after continuous inactivity, including uncertain Turn outcomes', () => {
  vi.useFakeTimers()
  try {
    const session = liveSession()
    const retired: string[] = []
    const stop = watchIdleSession(session.actor, 100, (id) => retired.push(id))
    session.identify(sessionId)
    vi.advanceTimersByTime(50)
    session.state('Sending')
    vi.advanceTimersByTime(100)
    expect(retired).toEqual([])
    session.feed({
      type: 'status',
      commandId: 'command-1',
      turnId: 'turn-1',
      vendorEventId: null,
      status: 'unknown',
    })
    session.state('Ready')
    vi.advanceTimersByTime(100)
    expect(retired).toEqual([sessionId])
    session.state('Ready')
    session.state('Failed')
    vi.advanceTimersByTime(100)
    expect(retired).toEqual([sessionId])
    stop()
    expect(session.listeners()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

test('delivers Feed events in order after a delayed Argo Session identity', () => {
  const journal = new SessionEventJournal()
  const session = liveSession()
  const stop = recordLiveSessionEvents(session.actor, journal)
  session.feed(message('first'))
  session.feed(message('second'))
  expect(journal.replay(sessionId, 0)).toMatchObject({ type: 'events', events: [] })
  session.identify(sessionId)
  session.feed(message('third'))
  expect(journal.replay(sessionId, 0)).toMatchObject({
    type: 'events',
    events: [
      { sequence: 1, content: { text: 'first' } },
      { sequence: 2, content: { text: 'second' } },
      { sequence: 3, content: { text: 'third' } },
    ],
  })
  stop()
  expect(session.listeners()).toBe(0)
})

test('announces each changed live child to the roster once', async () => {
  const database = migratedDatabase()
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'codex', nativeId: 'parent' })
    .run()
  const changes = new SessionListChanges()
  const announced: string[][] = []
  const unsubscribe = changes.subscribe((ids) => announced.push([...ids]))
  const session = liveSession()
  const stop = recordLiveSessionEvents(session.actor, undefined, { database, changes })
  const delegation = (status: 'running' | 'completed'): SessionLiveEventBody => ({
    type: 'content',
    commandId: null,
    turnId: null,
    vendorEventId: 'call-1',
    content: {
      id: 'call-1',
      kind: 'delegation',
      agentId: 'child',
      event: status === 'running' ? 'started' : 'responded',
      status,
      name: 'Review',
      prompt: null,
      model: null,
      summary: null,
    },
  })
  try {
    session.feed(delegation('running'))
    expect(announced).toEqual([])
    session.identify(sessionId)
    await Promise.resolve()
    expect(announced).toEqual([[sessionId]])
    session.feed(delegation('running'))
    await Promise.resolve()
    expect(announced).toEqual([[sessionId]])
    session.feed(delegation('completed'))
    await Promise.resolve()
    expect(announced).toEqual([[sessionId], [sessionId]])
    expect(database.select().from(sessionSubagent).all()).toMatchObject([
      { sessionId, subagentId: 'child', state: 'completed' },
    ])
  } finally {
    stop()
    unsubscribe()
    database.$client.close()
  }
})

test('bounds staged events across Sessions by count and bytes', () => {
  const journal = new SessionEventJournal(3, 900)
  const first = liveSession()
  const second = liveSession()
  const stopFirst = recordLiveSessionEvents(first.actor, journal)
  const stopSecond = recordLiveSessionEvents(second.actor, journal)
  first.feed(message('old'))
  second.feed(message('other'))
  for (const id of ['new-1', 'new-2', 'new-3']) first.feed(message(id))
  first.feed(message('oversize', 'x'.repeat(1000)))
  first.identify(sessionId)
  second.identify('00000000-0000-4000-8000-000000000002')
  expect(journal.replay(sessionId, 0)).toMatchObject({
    type: 'events',
    events: [
      { content: { text: 'new-1' } },
      { content: { text: 'new-2' } },
      { content: { text: 'new-3' } },
    ],
  })
  expect(journal.replay('00000000-0000-4000-8000-000000000002', 0)).toMatchObject({
    type: 'events',
    events: [],
  })
  stopFirst()
  stopSecond()
})

test('keeps at most 500 staged events before Session identity is available', () => {
  const journal = new SessionEventJournal()
  const session = liveSession()
  const stop = recordLiveSessionEvents(session.actor, journal)
  for (let index = 0; index < 510; index++) session.feed(message(`event-${index}`))
  session.identify(sessionId)
  const replay = journal.replay(sessionId, 0)
  expect(replay.type).toBe('events')
  if (replay.type === 'events') {
    expect(replay.events).toHaveLength(500)
    expect(replay.events[0]).toMatchObject({ content: { text: 'event-10' } })
    expect(replay.events.at(-1)).toMatchObject({ content: { text: 'event-509' } })
  }
  stop()
})

test('keeps staged bytes within the shared budget', () => {
  const journal = new SessionEventJournal(500, 400)
  const session = liveSession()
  const stop = recordLiveSessionEvents(session.actor, journal)
  session.feed(message('old', 'x'.repeat(160)))
  session.feed(message('latest', 'y'.repeat(160)))
  session.identify(sessionId)
  const replay = journal.replay(sessionId, 0)
  expect(replay.type).toBe('events')
  if (replay.type === 'events') {
    expect(replay.events).toHaveLength(1)
    expect(replay.events[0]).toMatchObject({ content: { text: 'y'.repeat(160) } })
  }
  stop()
})
