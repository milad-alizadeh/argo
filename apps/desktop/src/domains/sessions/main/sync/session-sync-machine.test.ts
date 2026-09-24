import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ActorLogic } from 'xstate'
import { createActor, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncMachine,
  sessionSyncMaxRetries,
} from './session-sync-machine'

const result = (input: SessionSyncJobInput, cursor: string | null): SessionSyncResult => ({
  cursor,
  generation: input.generation,
  indexedCount: 1,
  invalidRecordCount: 0,
})

const modeledEvents = [
  {
    type: 'xstate.done.actor.0.sessionSync.Syncing' as const,
    output: result({ cursor: null, generation: 0, priorityNativeId: null }, null),
  },
  {
    type: 'xstate.error.actor.0.sessionSync.Syncing' as const,
    error: 'temporary failure',
  },
  { type: 'Refresh' as const },
  { type: 'Priority sync' as const, nativeId: 'native-1' },
]
const modeledMachine = sessionSyncMachine.provide({
  actors: { sync: fromPromise(() => new Promise(() => undefined)) },
})
type ModeledSnapshot = ReturnType<typeof modeledMachine.getInitialSnapshot>
const modeledLogic = modeledMachine as unknown as ActorLogic<
  ModeledSnapshot,
  (typeof modeledEvents)[number]
>

test('models successful sync, retry, and priority paths', () => {
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

test('continues older discovery pages and restarts at recent on refresh', async () => {
  const cursors: Array<string | null> = []
  const machine = sessionSyncMachine.provide({
    actors: {
      sync: fromPromise(async ({ input }) => {
        cursors.push(input.cursor)
        return result(input, input.cursor === null ? '50' : null)
      }),
    },
  })
  const actor = createActor(machine, { input: {} }).start()
  try {
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting'))
    actor.send({ type: 'Refresh' })
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting') && cursors.length === 4)
    assert.deepEqual(cursors, [null, '50', null, '50'])
  } finally {
    actor.stop()
  }
})

test('looks up a priority Session and resumes the older page', async () => {
  const jobs: Array<{ cursor: string | null; priorityNativeId: string | null }> = []
  const machine = sessionSyncMachine.provide({
    actors: {
      sync: fromPromise(async ({ input }) => {
        jobs.push({ cursor: input.cursor, priorityNativeId: input.priorityNativeId })
        if (jobs.length === 2) return new Promise<SessionSyncResult>(() => undefined)
        if (input.priorityNativeId !== null) return result(input, null)
        return result(input, input.cursor === null ? '50' : null)
      }),
    },
  })
  const actor = createActor(machine, { input: {} }).start()
  try {
    await waitFor(actor, () => jobs.length === 2)
    actor.send({ type: 'Priority sync', nativeId: 'old-native-id' })
    await waitFor(actor, (snapshot) => snapshot.matches('Waiting') && jobs.length === 4)
    assert.deepEqual(jobs, [
      { cursor: null, priorityNativeId: null },
      { cursor: '50', priorityNativeId: null },
      { cursor: '50', priorityNativeId: 'old-native-id' },
      { cursor: '50', priorityNativeId: null },
    ])
  } finally {
    actor.stop()
  }
})

test('waits for the next poll after bounded failed attempts', async () => {
  let attempts = 0
  const machine = sessionSyncMachine.provide({
    actors: {
      sync: fromPromise<SessionSyncResult, SessionSyncJobInput>(async () => {
        attempts += 1
        throw new Error('Harness unavailable.')
      }),
    },
    delays: { retry: 0 },
  })
  const actor = createActor(machine, { input: {} }).start()
  try {
    await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches('Waiting') && snapshot.context.retryCount === sessionSyncMaxRetries + 1,
    )
    assert.equal(attempts, sessionSyncMaxRetries + 1)
    assert.equal(actor.getSnapshot().context.failure, 'Error: Harness unavailable.')
  } finally {
    actor.stop()
  }
})
