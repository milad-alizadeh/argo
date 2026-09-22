import { beforeEach, expect, test } from 'bun:test'
import {
  COCKPIT,
  mockStart,
  newSessionDeps,
  PROJECT,
} from '../../../../../../mocks/sessions/mock-send-turn'
import { useSessionCreationStore } from '../../session-creation'
import { sendToNewSession } from './send-turn'
import { startNewSession } from './use-start-new-session'

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

const pendingIdentity = (sessionId: string) =>
  ({ kind: 'pending', sessionId, projectId: PROJECT.id }) as const

// A "+" already opened the optimistic row (#2109): sending reuses it rather than starting a
// second draft, and the Roster's optimistic id resolves to the real one in place.
test('a Send against an already-pending row reuses it instead of beginning a second one', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  const start = mockStart(async () => ({ sessionId: 'session-new' }))
  const sent = await sendToNewSession(newSessionDeps(start, pendingIdentity(opened.id)))
  expect(sent).toBe(true)
  expect(start.calls.length).toBe(1)
  expect(useSessionCreationStore.getState().pending).toEqual({
    stage: 'reconciling',
    id: 'session-new',
    harness: 'claude',
    cwd: PROJECT.path,
    prompt: 'hello',
  })
})

// One user action produces at most one new Session, even under N rapid Enter presses (#2109).
test('a second rapid Send while the first is still starting is dropped', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  useSessionCreationStore.getState().startSubmission(opened.id, 'hello')
  const start = mockStart(async () => ({ sessionId: 'session-new' }))
  const sent = await sendToNewSession(newSessionDeps(start, pendingIdentity(opened.id)))
  expect(sent).toBe(false)
  expect(start.calls).toEqual([])
})

// A genuine creation failure clears the optimistic row and sends the reader back to a fresh
// composer rather than leaving them stuck on an id nothing will ever resolve (#2109).
test('a failed start clears the pending row and leaves the composer navigable again', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  const start = mockStart(async () => {
    throw new Error('boom')
  })
  const navigated: unknown[] = []
  const sent = await sendToNewSession(
    newSessionDeps(start, pendingIdentity(opened.id), (...args) => {
      navigated.push(args)
      return undefined as never
    }),
  )
  expect(sent).toBe(false)
  expect(useSessionCreationStore.getState().pending).toBeNull()
  expect(navigated).toEqual([['/sessions/new', { replace: true }]])
})

test('selects the real Session before releasing its first Claude turn', async () => {
  const events: string[] = []
  const started = await startNewSession(
    {
      harness: 'claude',
      cockpit: COCKPIT,
      identity: { kind: 'draft', projectId: PROJECT.id },
      prompt: 'hello',
      setup: null,
      attachments: [],
      start: mockStart(async () => ({ sessionId: 'session-new' })),
      setFailure: () => {},
    },
    {
      onSubmitted: () => events.push('submitted'),
      onStarted: () => events.push('selected'),
      afterStart: async () => events.push('refreshed'),
      sendInitialTurn: async () => events.push('sent'),
      onFailed: () => {},
    },
  )

  expect(started).toBe(true)
  expect(events).toEqual(['submitted', 'selected', 'refreshed', 'sent'])
})
