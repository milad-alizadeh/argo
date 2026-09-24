import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ActorLogic } from 'xstate'
import { createActor, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { sessionSyncMachine } from './session-sync-machine'

const modeledEvents = [
  {
    type: 'xstate.done.actor.0.sessionSync.Syncing' as const,
    output: {
      complete: true,
      cursor: null,
      generation: 0,
      indexedCount: 2,
      invalidRecordCount: 1,
      page: 0,
      sessions: [],
    },
  },
  {
    type: 'xstate.error.actor.0.sessionSync.Syncing' as const,
    error: 'temporary failure',
  },
  { type: 'Refresh' as const },
  { type: 'Priority sync' as const },
]
const modeledMachine = sessionSyncMachine.provide({
  actors: { sync: fromPromise(() => new Promise(() => undefined)) },
})
type ModeledSnapshot = ReturnType<typeof modeledMachine.getInitialSnapshot>
const modeledLogic = modeledMachine as unknown as ActorLogic<
  ModeledSnapshot,
  (typeof modeledEvents)[number]
>

test('models a successful sync, retry, and priority refresh', () => {
  const paths = getShortestPaths(modeledLogic, {
    input: {},
    serializeState: (snapshot) => String(snapshot.value),
    events: (snapshot) => {
      if (snapshot.matches('Syncing'))
        return modeledEvents.filter((event) => event.type.startsWith('xstate.'))
      if (snapshot.matches('Waiting'))
        return modeledEvents.filter((event) => event.type === 'Priority sync')
      return modeledEvents.filter((event) => event.type === 'Refresh')
    },
  })
  assert.deepEqual(
    new Set(paths.map(({ state }) => String(state.value))),
    new Set(['Syncing', 'Waiting', 'Retrying']),
  )
})

test('continues from the next bounded discovery page before restarting', async () => {
  const jobs: Array<{ generation: number; page: number }> = []
  const machine = sessionSyncMachine.provide({
    actors: {
      sync: fromPromise(async ({ input }) => {
        jobs.push({ generation: input.generation, page: input.page })
        return {
          complete: input.page === 1,
          cursor: input.page === 0 ? 'older' : null,
          generation: input.generation,
          indexedCount: 1,
          invalidRecordCount: 0,
          page: input.page,
          sessions: [],
        }
      }),
    },
  })
  const actor = createActor(machine, { input: {} }).start()
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting') && snapshot.context.page === 1)
    actor.send({ type: 'Refresh' })
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting') && snapshot.context.page === 0)
    assert.deepEqual(jobs, [
      { generation: 0, page: 0 },
      { generation: 1, page: 1 },
    ])
  } finally {
    actor.stop()
  }
})

test('priority refresh restarts discovery from the recent page', async () => {
  const jobs: number[] = []
  const machine = sessionSyncMachine.provide({
    actors: {
      sync: fromPromise(async ({ input }) => {
        jobs.push(input.page)
        return {
          complete: false,
          cursor: 'older',
          generation: input.generation,
          indexedCount: 1,
          invalidRecordCount: 0,
          page: input.page,
          sessions: [],
        }
      }),
    },
  })
  const actor = createActor(machine, { input: {} }).start()
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting') && snapshot.context.page === 1)
    actor.send({ type: 'Priority sync' })
    await waitFor(actor, () => jobs.length === 2)
    assert.deepEqual(jobs, [0, 0])
  } finally {
    actor.stop()
  }
})
