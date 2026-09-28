import { expect, test } from 'bun:test'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { SessionEventJournal } from './session-event-journal'

const sessionId = '00000000-0000-4000-8000-000000000001'
const secondSessionId = '00000000-0000-4000-8000-000000000002'
const running: SessionLiveEventBody = {
  type: 'status',
  commandId: null,
  turnId: null,
  vendorEventId: null,
  status: 'running',
}

test('assigns a per-Session sequence and replays from a cursor', () => {
  const journal = new SessionEventJournal()
  journal.append(sessionId, running)
  journal.append(sessionId, running)
  journal.append(secondSessionId, running)

  expect(journal.replay(sessionId, 0)).toMatchObject({
    type: 'events',
    cursor: 2,
    events: [{ sequence: 1 }, { sequence: 2 }],
  })
  expect(journal.replay(sessionId, 1)).toMatchObject({
    type: 'events',
    events: [{ sequence: 2 }],
  })
  expect(journal.replay(secondSessionId, 0)).toMatchObject({
    type: 'events',
    cursor: 1,
    events: [{ sequence: 1 }],
  })
})

test('expires an evicted cursor and starts empty in a new process', () => {
  const journal = new SessionEventJournal(2)
  for (let index = 0; index < 3; index += 1) journal.append(sessionId, running)
  expect(journal.replay(sessionId, 0)).toEqual({ type: 'expired', cursor: 3 })
  expect(journal.replay(sessionId, 1)).toMatchObject({
    type: 'events',
    events: [{ sequence: 2 }, { sequence: 3 }],
  })

  const restarted = new SessionEventJournal()
  expect(restarted.replay(sessionId, 1)).toEqual({ type: 'expired', cursor: 0 })
  expect(restarted.replay(sessionId, 0)).toEqual({ type: 'events', events: [], cursor: 0 })
})

test('limits replay bytes across Sessions and still broadcasts an oversized event', () => {
  const sample = new SessionEventJournal().append(sessionId, running)
  const bytes = Buffer.byteLength(JSON.stringify(sample), 'utf8')
  const journal = new SessionEventJournal(500, bytes * 2 - 1)
  journal.append(sessionId, running)
  journal.append(secondSessionId, running)
  expect(journal.replay(sessionId, 0)).toEqual({ type: 'expired', cursor: 1 })
  expect(journal.replay(secondSessionId, 0)).toMatchObject({
    type: 'events',
    events: [{ sequence: 1 }],
  })

  const oversized = new SessionEventJournal(500, 1)
  const received: number[] = []
  oversized.subscribe(sessionId, (event) => received.push(event.sequence))
  oversized.append(sessionId, running)
  expect(received).toEqual([1])
  expect(oversized.replay(sessionId, 0)).toEqual({ type: 'expired', cursor: 1 })
})

test('subscribers receive appended events once and can disconnect', () => {
  const journal = new SessionEventJournal()
  const sequences: number[] = []
  const unsubscribe = journal.subscribe(sessionId, (event) => sequences.push(event.sequence))
  journal.append(sessionId, running)
  unsubscribe()
  journal.append(sessionId, running)
  expect(sequences).toEqual([1])
})
