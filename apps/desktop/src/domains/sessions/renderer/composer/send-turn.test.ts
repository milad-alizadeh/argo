import { beforeEach, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import {
  type DraftSendDeps,
  sendToDraftIdentity,
} from '@/domains/sessions/renderer/composer/send-draft-turn'
import { sendToNewSession, sendToSelected } from '@/domains/sessions/renderer/composer/send-turn'
import { useSessionCreationStore } from '@/domains/sessions/renderer/session-creation'
import {
  COCKPIT,
  mockMutation,
  mockStart,
  newSessionDeps,
  PROJECT,
  SETUP,
} from '../../../../../mocks/sessions/mock-send-turn'
import { mockTurnMarker } from '../../../../../mocks/sessions/mock-turn-marker'

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

// The identity's session variant routes a Send to that Session, never a new one.
test('a Send with a selected Session sends to it', async () => {
  const send = mockMutation<{ prompt: string; sessionId: string; setup: unknown }, void>(
    async () => undefined,
  )
  const watched: unknown[] = []
  const sent = await sendToSelected({
    queryClient: new QueryClient(),
    since: null,
    selectedSessionId: 'session-1',
    send: send as never,
    setFailure: () => {},
    turn: { prompt: 'hello', setup: SETUP, attachments: [] } as never,
    watchTurn: (...args) => watched.push(args),
  })
  expect(sent).toBe(true)
  expect(send.calls).toEqual([
    { prompt: 'hello', sessionId: 'session-1', setup: SETUP, attachments: [] },
  ])
  expect(watched).toEqual([['session-1', SETUP, null]])
})

// The identity's draft variant routes a Send to starting a fresh Session, and moves there.
test('a Send with no prior Session starts one and navigates to it', async () => {
  const start = mockStart(async () => ({ sessionId: 'session-new' }))
  const navigated: unknown[] = []
  const sent = await sendToNewSession(
    newSessionDeps(start, { kind: 'draft', projectId: PROJECT.id }, (...args) => {
      navigated.push(args)
      return undefined as never
    }),
  )
  expect(sent).toBe(true)
  expect(start.calls).toEqual([
    { harness: 'claude', cwd: '/argo', prompt: 'hello', setup: SETUP, attachments: [] },
  ])
  expect(navigated).toEqual([['/sessions/session-new', { replace: true, state: 'focus-composer' }]])
})

// Rapid Enter presses on a new Session (#2229): the dropped duplicate leaves the first Send's
// Turn Marker in place, so Starting Session shows until the Session answers.
test("a dropped duplicate Send keeps the first Send's Turn Marker", async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  let answer: (reply: { sessionId: string }) => void = () => {}
  const start = mockMutation(
    () =>
      new Promise<{ sessionId: string }>((resolve) => {
        answer = resolve
      }),
  )
  const marker = mockTurnMarker()
  const deps: DraftSendDeps = {
    harness: 'claude',
    cockpit: COCKPIT,
    navigate: () => undefined as never,
    queryClient: new QueryClient(),
    marker,
    setFailure: () => {},
    start: start as never,
    watchTurn: () => {},
  }
  const identity = { kind: 'pending', sessionId: opened.id, projectId: PROJECT.id } as const
  const turn = { prompt: 'hello', setup: null, attachments: [] }

  const first = sendToDraftIdentity(deps, identity, turn)
  expect(await sendToDraftIdentity(deps, identity, turn)).toBe(false)
  expect([...marker.entries.keys()]).toEqual([opened.id])
  answer({ sessionId: 'session-new' })
  expect(await first).toBe(true)
  expect([...marker.entries.keys()]).toEqual(['session-new'])
  expect(start.calls.length).toBe(1)
})

// A pending Composer moves its state to the real Session only after the Session id arrives.
test('a Send from a pending Composer reports the real Session id after rekeying', async () => {
  const opened = useSessionCreationStore.getState().begin('claude', PROJECT.path)
  const started: string[] = []
  const marker = mockTurnMarker()
  const deps: DraftSendDeps = {
    harness: 'claude',
    cockpit: COCKPIT,
    navigate: () => undefined as never,
    queryClient: new QueryClient(),
    marker,
    setFailure: () => {},
    start: mockMutation(async () => ({ sessionId: 'session-new' })) as never,
    watchTurn: () => {},
  }
  const identity = { kind: 'pending', sessionId: opened.id, projectId: PROJECT.id } as const

  await sendToDraftIdentity(
    { ...deps, onStarted: (sessionId) => started.push(sessionId) },
    identity,
    { prompt: 'hello', setup: null, attachments: [] },
  )

  expect(started).toEqual(['session-new'])
  expect([...marker.entries.keys()]).toEqual(['session-new'])
})
