import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sendToSessionIdentity } from '@/domains/sessions/renderer/composer/send-turn'
import { mockTurnMarker } from '../../../../../mocks/sessions/mock-turn-marker'

function managedClaudeDeps(
  marker: ReturnType<typeof mockTurnMarker>,
  sendManagedClaude: Parameters<typeof sendToSessionIdentity>[0]['sendManagedClaude'],
  failures: unknown[],
) {
  return {
    marker,
    queryClient: new QueryClient(),
    roster: {
      sessions: [{ id: 'session-1', harness: 'claude', posture: 'managed', turnStartedAt: null }],
    } as never,
    send: { mutateAsync: async () => undefined } as never,
    sendManagedClaude,
    setFailure: (failure: unknown) => failures.push(failure),
    watchTurn: () => {},
  }
}

test('an uncertain managed Claude Send keeps its Turn Marker and draft state', async () => {
  const marker = mockTurnMarker()
  const failures: unknown[] = []

  await expect(
    sendToSessionIdentity(
      managedClaudeDeps(marker, async () => ({ kind: 'uncertain' }), failures),
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
      managedClaudeDeps(
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

test('an external Claude Session uses the drive adapter to establish management', async () => {
  const marker = mockTurnMarker()
  const sent: unknown[] = []
  const managed: unknown[] = []
  const deps = managedClaudeDeps(
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
