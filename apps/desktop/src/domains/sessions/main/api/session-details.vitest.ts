import { initTRPC } from '@trpc/server'
import { expect, test, vi } from 'vitest'
import { waitFor } from 'xstate'
import { databaseFrom } from '@/database/database'
import type { CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-client'
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
import { liveSessionActorFor } from '../live/live-session-supervisor-machine'
import { sessionDetailsProcedure } from './session-details'
import { SessionRosterChanges } from './session-roster-changes'

if (model === undefined) throw new Error('The Codex fixture needs a model.')
const openingEffort = model.defaultEffort
const twoEffortCatalog = harnessCatalogSchema.parse({
  harnesses: [
    unavailable('claude'),
    { ...available, models: [{ ...model, efforts: [openingEffort, 'deep'] }] },
    unavailable('claude-acp'),
  ],
})

type Details = { posture: string | null; effort: string | null }

// Starts a Codex Session whose first Turn completes, then follows its selected details while the
// test sends a second command until `settled`; `secondTurn` answers that command's `turn/start`.
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
  const details = initTRPC
    .create()
    .router({
      details: sessionDetailsProcedure({
        database: databaseFrom(client),
        supervisor,
        roster: new SessionRosterChanges(),
      }),
    })
    .createCaller({}).details
  const seen: Details[] = []
  try {
    const { sessionId } = await start(supervisor, first)
    const child = liveSessionActorFor(supervisor, sessionId)
    if (child === undefined) throw new Error('The started Session has no live actor.')
    await waitFor(child, (snapshot) => snapshot.context.feedSerial >= 1)
    completeCodexTurn(notify, 'turn-2')
    await waitFor(child, (snapshot) => snapshot.matches('Ready'))
    const stream = await details({ sessionId })
    const subscription = stream.subscribe({
      next: ({ details }) =>
        seen.push({
          posture: details?.posture ?? null,
          effort: details?.turnConfiguration.effort ?? null,
        }),
    })
    send(supervisor, {
      ...first,
      commandId: 'deeper',
      sessionId,
      turnConfiguration: { ...first.turnConfiguration, effort: 'deep' },
    }).catch(() => {})
    await vi.waitFor(() => expect(settled(seen)).toBe(true))
    subscription.unsubscribe()
    return seen
  } finally {
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

  expect(seen.at(-1)).toEqual({ posture: null, effort: null })
})
