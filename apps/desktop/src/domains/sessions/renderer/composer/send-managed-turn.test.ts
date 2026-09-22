import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { sendToSessionIdentity } from '@/domains/sessions/renderer/composer/send-turn'
import {
  beginEntry,
  clearEntry,
  type TurnMarkerApi,
  type TurnMarkerEntries,
} from '@/domains/sessions/renderer/composer/use-turn-marker'

function turnMarker() {
  const marker = {
    entries: new Map() as TurnMarkerEntries,
    begin: (key: string, entry: Parameters<TurnMarkerApi['begin']>[1]) => {
      marker.entries = beginEntry(marker.entries, key, { ...entry, startedAt: 0 })
    },
    rekey: () => {},
    clear: (key: string) => {
      marker.entries = clearEntry(marker.entries, key)
    },
  }
  return marker
}

function managedClaudeDeps(
  marker: ReturnType<typeof turnMarker>,
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
  const marker = turnMarker()
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
  const marker = turnMarker()
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
