import { beforeEach, expect, test } from 'bun:test'
import { sendToNewSession } from '@/domains/sessions/renderer/hooks/send-turn'
import { useSessionCreationStore } from '@/domains/sessions/renderer/state/use-session-creation-store'
import { mockStart, newSessionDeps, PROJECT } from '../../../../../mocks/sessions/mock-send-turn'

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
    cli: 'claude',
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
