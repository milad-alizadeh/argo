import { expect, test } from 'vitest'
import { recordLiveSessionEvents } from './live-session-supervisor-machine'
import { SessionEventJournal } from './session-event-journal'

const sessionId = '00000000-0000-4000-8000-000000000001'

test('buffers live content until a delayed native identity binds to the Argo Session', () => {
  const journal = new SessionEventJournal()
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
