import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { SessionEventJournal } from './session-event-journal'

const sessionId = '00000000-0000-4000-8000-000000000001'
let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-live-journal-'))
  database = openDatabase(directory)
  for (const argoId of [sessionId, '00000000-0000-4000-8000-000000000002']) {
    database.insert(sessionTable).values({ argoId, harness: 'claude', nativeId: argoId }).run()
  }
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

test('assigns a monotonic per-Session sequence and replays events after a cursor', () => {
  const journal = new SessionEventJournal(database, 3)
  journal.append(sessionId, {
    type: 'content',
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: 'message-1',
    content: { id: 'message-1', kind: 'message', role: 'user', text: 'Hello' },
  })
  journal.append(sessionId, {
    type: 'status',
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: null,
    status: 'running',
  })
  journal.append('00000000-0000-4000-8000-000000000002', {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })

  expect(journal.replay(sessionId, 0)).toMatchObject({
    type: 'events',
    events: [{ sequence: 1 }, { sequence: 2 }],
  })
  expect(journal.replay(sessionId, 1)).toMatchObject({ type: 'events', events: [{ sequence: 2 }] })
  expect(journal.replay(sessionId, 2)).toMatchObject({ type: 'events', events: [] })
})

test('reports an expired cursor and keeps the sequence across a new journal instance', () => {
  const journal = new SessionEventJournal(database, 2)
  for (let index = 0; index < 3; index += 1) {
    journal.append(sessionId, {
      type: 'status',
      commandId: null,
      turnId: null,
      vendorEventId: null,
      status: 'running',
    })
  }
  expect(journal.replay(sessionId, 0)).toEqual({ type: 'expired', cursor: 3 })
  expect(journal.replay(sessionId, 1)).toMatchObject({
    type: 'events',
    events: [{ sequence: 2 }, { sequence: 3 }],
  })
  expect(
    new SessionEventJournal(database, 2).append(sessionId, {
      type: 'status',
      commandId: null,
      turnId: null,
      vendorEventId: null,
      status: 'idle',
    }).sequence,
  ).toBe(4)
})

test('subscribers receive appended events once and can disconnect', () => {
  const journal = new SessionEventJournal(database)
  const sequences: number[] = []
  const unsubscribe = journal.subscribe(sessionId, (event) => sequences.push(event.sequence))
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'running',
  })
  unsubscribe()
  journal.append(sessionId, {
    type: 'status',
    commandId: null,
    turnId: null,
    vendorEventId: null,
    status: 'idle',
  })
  expect(sequences).toEqual([1])
})
