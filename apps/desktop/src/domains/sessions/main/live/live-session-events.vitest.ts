import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { SessionEventJournal } from '../database/session-event-journal'
import { recordLiveSessionEvents } from './live-session-supervisor-machine'

const sessionId = '00000000-0000-4000-8000-000000000001'
let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-event-observer-'))
  database = openDatabase(directory)
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'native-1' })
    .run()
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

test('buffers live content until a delayed native identity binds to the Argo Session', () => {
  const journal = new SessionEventJournal(database)
  const listeners = new Set<(snapshot: unknown) => void>()
  const session = {
    subscribe(listener: (snapshot: unknown) => void) {
      listeners.add(listener)
      return { unsubscribe: () => listeners.delete(listener) }
    },
  } as unknown as Parameters<typeof recordLiveSessionEvents>[0]
  const stop = recordLiveSessionEvents(session, journal)
  const feedEvents = [
    {
      serial: 1,
      body: {
        type: 'content',
        commandId: 'command-1',
        turnId: 'turn-1',
        vendorEventId: 'message-1',
        content: { id: 'message-1', kind: 'message', role: 'assistant', text: 'Live reply' },
      },
    },
  ]
  for (const listener of listeners) listener({ context: { argoId: null, feedEvents } })
  expect(journal.replay(sessionId, 0)).toMatchObject({ type: 'events', events: [] })
  for (const listener of listeners) listener({ context: { argoId: sessionId, feedEvents } })
  expect(journal.replay(sessionId, 0)).toMatchObject({
    type: 'events',
    events: [{ sequence: 1, content: { text: 'Live reply' } }],
  })
  stop()
  expect(listeners.size).toBe(0)
})
