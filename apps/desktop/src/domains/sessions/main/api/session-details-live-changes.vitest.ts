import { expect, test, vi } from 'vitest'
import { waitFor } from 'xstate'
import { databaseFrom } from '@/database/database'
import { ACP_HARNESSES } from '@/harnesses/acp/acp-agents'
import type { CodexRequest } from '@/harnesses/codex/app-server'
import { harnessCatalogSchema, unavailable } from '@/harnesses/harness-catalog'
import {
  available,
  completeCodexTurn,
  first,
  model,
  recordingCodexRequest,
  send,
  start,
  supervisorFor,
} from '@/mocks/sessions/live-session-supervisor.fixture'
import { sessionListCaller } from '@/mocks/sessions/session-list-caller'
import { liveSessionActorFor } from '../live'

if (model === undefined) throw new Error('The Codex fixture needs a model.')
const openingEffort = model.defaultEffort
const twoEffortCatalog = harnessCatalogSchema.parse({
  harnesses: [
    unavailable('claude'),
    { ...available, models: [{ ...model, efforts: [openingEffort, 'deep'] }] },
    ...ACP_HARNESSES.map((harness) => unavailable(harness)),
  ],
})

type Details = { posture: string | null; effort: string | null }

// Starts a Codex Session whose first Turn completes, then reads its details on each announced change
// while the test sends a second command until `settled`; `secondTurn` answers that `turn/start`.
async function detailsAroundSecondSend(
  secondTurn: () => Promise<never>,
  settled: (seen: readonly Details[]) => boolean,
) {
  const recording = recordingCodexRequest()
  const request: CodexRequest = (method, params, parse) =>
    recording.calls.includes('turn/start') && method === 'turn/start'
      ? secondTurn()
      : recording.request(method, params, parse)
  const { root, supervisor, client, notify } = await supervisorFor(request, twoEffortCatalog)
  const { details, sessionListChanges, stopWatching } = sessionListCaller({
    database: databaseFrom(client),
    supervisor,
  })
  const seen: Details[] = []
  try {
    const { sessionId } = await start(supervisor, first)
    const child = liveSessionActorFor(supervisor, sessionId)
    if (child === undefined) throw new Error('The started Session has no live actor.')
    await waitFor(child, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-2')
    await waitFor(child, (snapshot) => snapshot.matches('Ready'))
    const read = async () => {
      const row = await details({ sessionId })
      seen.push({
        posture: row?.posture ?? null,
        effort: row?.turnConfiguration.effort ?? null,
      })
    }
    await read()
    const unsubscribe = sessionListChanges.subscribe((sessionIds) => {
      if (sessionIds.includes(sessionId)) void read()
    })
    send(supervisor, {
      ...first,
      commandId: 'deeper',
      sessionId,
      turnConfiguration: { ...first.turnConfiguration, effort: 'deep' },
    }).catch(() => {})
    await vi.waitFor(() => expect(settled(seen)).toBe(true))
    unsubscribe()
    return seen
  } finally {
    stopWatching()
    root.send({ type: 'Shutdown' })
    client.close()
  }
}

test('refreshes selected details when a live Send changes the Turn configuration', async () => {
  // The second Turn never starts, so no Feed event can announce the change in its place.
  const seen = await detailsAroundSecondSend(
    () => new Promise(() => {}),
    (seen) => seen.length >= 2,
  )

  expect(seen).toEqual([
    { posture: 'live', effort: openingEffort },
    { posture: 'live', effort: 'deep' },
  ])
})

test('refreshes selected details when the live channel fails', async () => {
  const seen = await detailsAroundSecondSend(
    async () => {
      throw new Error('The vendor closed the channel.')
    },
    (seen) => seen.at(-1)?.posture === null,
  )

  // The row keeps the configuration the channel last held.
  expect(seen.at(-1)).toEqual({ posture: null, effort: 'deep' })
})

test('shows the context usage a live Turn reported when it ended, and keeps it once closed', async () => {
  const { root, supervisor, client, notify } = await supervisorFor(recordingCodexRequest().request)
  const database = databaseFrom(client)
  const { details, stopWatching } = sessionListCaller({ database, supervisor })
  try {
    const { sessionId } = await start(supervisor, first)
    const child = liveSessionActorFor(supervisor, sessionId)
    if (child === undefined) throw new Error('The started Session has no live actor.')
    await waitFor(child, (snapshot) => snapshot.context.feedSerial >= 1)
    notify({
      method: 'thread/tokenUsage/updated',
      params: {
        threadId: 'native-1',
        turnId: 'turn-2',
        tokenUsage: {
          last: { totalTokens: 48_000 },
          total: { totalTokens: 90_000 },
          modelContextWindow: 256_000,
        },
      },
    })
    expect((await details({ sessionId }))?.contextUsage).toBeNull()
    completeCodexTurn(notify, 'turn-2')
    const reported = { usedTokens: 48_000, windowTokens: 256_000 }
    await vi.waitFor(async () =>
      expect((await details({ sessionId }))?.contextUsage).toEqual(reported),
    )
    root.send({ type: 'Shutdown' })
    const stored = sessionListCaller({ database })
    expect((await stored.details({ sessionId }))?.contextUsage).toEqual(reported)
    stored.stopWatching()
  } finally {
    stopWatching()
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
