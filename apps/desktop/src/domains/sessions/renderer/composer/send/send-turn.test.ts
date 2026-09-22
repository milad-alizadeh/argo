import { beforeEach, expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { useSessionCreationStore } from '../../session-creation'
import {
  COCKPIT,
  mockMutation,
  mockStart,
  newSessionDeps,
  PROJECT,
  SETUP,
} from '../../../../../../mocks/sessions/mock-send-turn'
import { mockTurnMarker } from '../../../../../../mocks/sessions/mock-turn-marker'
import { type DraftSendDeps, sendToDraftIdentity } from './send-draft-turn'
import { sendToNewSession, sendToSelected, sendToSessionIdentity } from './send-turn'

function managedSessionDeps(
  marker: ReturnType<typeof mockTurnMarker>,
  sendManagedSession: Parameters<typeof sendToSessionIdentity>[0]['sendManagedSession'],
  failures: unknown[],
) {
  return {
    marker,
    queryClient: new QueryClient(),
    roster: {
      sessions: [{ id: 'session-1', harness: 'claude', posture: 'managed', turnStartedAt: null }],
    } as never,
    send: { mutateAsync: async () => undefined } as never,
    sendManagedSession,
    setFailure: (failure: unknown) => failures.push(failure),
    watchTurn: () => {},
  }
}

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

const draftSendBase = {
  harness: 'claude' as const,
  cockpit: COCKPIT,
  navigate: () => undefined as never,
  queryClient: new QueryClient(),
  setFailure: () => {},
  send: mockMutation(async () => undefined) as never,
  watchTurn: () => {},
}

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
    {
      harness: 'claude',
      cwd: '/argo',
      prompt: 'hello',
      deferInitialTurn: true,
      setup: SETUP,
      attachments: [],
    },
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
    ...draftSendBase,
    marker,
    start: start as never,
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
    ...draftSendBase,
    marker,
    start: mockMutation(async () => ({ sessionId: 'session-new' })) as never,
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

test('an uncertain managed Claude Send keeps its Turn Marker and draft state', async () => {
  const marker = mockTurnMarker()
  const failures: unknown[] = []

  await expect(
    sendToSessionIdentity(
      managedSessionDeps(marker, async () => ({ kind: 'uncertain' }), failures),
      'session-1',
      { prompt: 'hello', setup: null, attachments: [] },
    ),
  ).resolves.toBe('uncertain')

  expect([...marker.entries.keys()]).toEqual(['session-1'])
  expect(failures).toEqual([])
})

test('a rejected managed Claude Send clears its Turn Marker and reports the reason', async () => {
  const marker = mockTurnMarker()
  const failures: unknown[] = []

  await expect(
    sendToSessionIdentity(
      managedSessionDeps(
        marker,
        async () => ({ kind: 'rejected', reason: 'Session is unavailable' }),
        failures,
      ),
      'session-1',
      { prompt: 'hello', setup: null, attachments: [] },
    ),
  ).resolves.toBe('rejected')

  expect([...marker.entries.keys()]).toEqual([])
  expect(failures).toEqual([
    { sessionId: 'session-1', message: 'Session is unavailable', code: null },
  ])
})

test('a managed Codex Session sends through its managed adapter', async () => {
  const marker = mockTurnMarker()
  const sent: unknown[] = []
  const managed: unknown[] = []
  const deps = managedSessionDeps(
    marker,
    async (harness, sessionId, prompt) => {
      managed.push({ harness, sessionId, prompt })
      return { kind: 'accepted', projection: {} as never }
    },
    [],
  )
  deps.roster = {
    sessions: [{ id: 'session-1', harness: 'codex', posture: 'managed', turnStartedAt: null }],
  } as never
  deps.send = {
    mutateAsync: async (request: unknown) => {
      sent.push(request)
    },
  } as never

  await expect(
    sendToSessionIdentity(deps, 'session-1', {
      prompt: 'Fail this Turn.',
      setup: { model: 'gpt-5.6-sol', effort: 'low', mode: 'workspace-write' },
      attachments: [],
    }),
  ).resolves.toBe('accepted')

  expect(managed).toEqual([{ harness: 'codex', sessionId: 'session-1', prompt: 'Fail this Turn.' }])
  expect(sent).toEqual([])
})

test('an external Claude Session uses the drive adapter to establish management', async () => {
  const marker = mockTurnMarker()
  const sent: unknown[] = []
  const managed: unknown[] = []
  const deps = managedSessionDeps(
    marker,
    async (sessionId, prompt) => {
      managed.push({ sessionId, prompt })
      return { kind: 'accepted', projection: {} as never }
    },
    [],
  )
  deps.roster = {
    sessions: [{ id: 'session-1', harness: 'claude', posture: 'external', turnStartedAt: null }],
  } as never
  deps.send = {
    mutateAsync: async (request: unknown) => {
      sent.push(request)
    },
  } as never

  await expect(
    sendToSessionIdentity(deps, 'session-1', {
      prompt: 'Resume this Session.',
      setup: null,
      attachments: [],
    }),
  ).resolves.toBe(true)

  expect(sent).toEqual([
    {
      sessionId: 'session-1',
      prompt: 'Resume this Session.',
      setup: null,
      attachments: [],
    },
  ])
  expect(managed).toEqual([])
})
