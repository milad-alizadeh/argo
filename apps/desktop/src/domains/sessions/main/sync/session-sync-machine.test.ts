import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, type EventFrom, fromPromise, waitFor } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import type {
  SessionSummaryList,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { SESSION_SYNC_BATCH_SIZE, sessionSyncMachine } from './session-sync-machine'

const twoBatchRecords = Array.from({ length: SESSION_SYNC_BATCH_SIZE + 1 }, (_value, index) => ({
  nativeId: `native-${index}`,
  customTitle: null,
}))
const listSessionSummaries: SessionSummaryList = async () => ({ records: [], skipped: 0 })
const input = { harness: 'claude' as const, knownNativeIds: [], listSessionSummaries }
const fetchTwoBatchRecords = fromPromise<
  SessionSummaryListResult,
  { knownNativeIds: string[]; listSessionSummaries: SessionSummaryList }
>(async () => ({
  records: twoBatchRecords,
  skipped: 0,
}))

test('moves from Idle through Fetching and Saving to Ready', async () => {
  let saved = 0
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        save: fromPromise(async ({ input }) => {
          saved += input.records.length
        }),
      },
    }),
    {
      input: {
        ...input,
        listSessionSummaries: async () => ({
          records: [{ nativeId: 'native-1', customTitle: null }],
          skipped: 2,
        }),
      },
    },
  ).start()
  try {
    assert.ok(actor.getSnapshot().matches('Idle'))
    actor.send({ type: 'Start' })
    await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
    assert.equal(actor.getSnapshot().context.processed, 1)
    assert.equal(actor.getSnapshot().context.skipped, 2)
    assert.equal(saved, 1)
  } finally {
    actor.stop()
  }
})

test('fails after three fetch attempts', async () => {
  let attempts = 0
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fromPromise<
          SessionSummaryListResult,
          { knownNativeIds: string[]; listSessionSummaries: SessionSummaryList }
        >(async () => {
          attempts += 1
          throw new Error('Claude is unavailable.')
        }),
      },
    }),
    { input },
  ).start()
  try {
    actor.send({ type: 'Start' })
    await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
    assert.equal(attempts, 3)
  } finally {
    actor.stop()
  }
})

test('saves each committed batch once and advances progress after each commit', async () => {
  const saved: string[][] = []
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fetchTwoBatchRecords,
        save: fromPromise(async ({ input }) => {
          saved.push(input.records.map((record) => record.nativeId))
        }),
      },
    }),
    { input },
  ).start()
  try {
    actor.send({ type: 'Start' })
    await waitFor(actor, (snapshot) => snapshot.matches('Ready'))
    assert.deepEqual(
      saved.map((batch) => batch.length),
      [50, 1],
    )
    assert.equal(actor.getSnapshot().context.processed, 51)
  } finally {
    actor.stop()
  }
})

test('fails on the first failed SQL batch without a retry', async () => {
  const batches: string[][] = []
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fetchTwoBatchRecords,
        save: fromPromise(async ({ input }) => {
          batches.push(input.records.map((record) => record.nativeId))
          if (input.records.length === 1) throw new Error('Locked database.')
        }),
      },
    }),
    { input },
  ).start()
  try {
    actor.send({ type: 'Start' })
    await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
    assert.deepEqual(
      batches.map((batch) => batch.length),
      [50, 1],
    )
    assert.equal(actor.getSnapshot().context.processed, 50)
  } finally {
    actor.stop()
  }
})

test('covers the Idle, Fetching, Saving, Ready, Failed, and Shutdown graph paths', () => {
  const paths = getShortestPaths(sessionSyncMachine, {
    input,
    events: (snapshot): EventFrom<typeof sessionSyncMachine>[] => {
      if (snapshot.matches('Idle')) return [{ type: 'Start' }, { type: 'Shutdown' }]
      if (snapshot.matches('Fetching'))
        return [
          {
            type: 'xstate.done.actor.fetch',
            output: { records: [{ nativeId: 'native-1', customTitle: null }], skipped: 0 },
          },
          { type: 'xstate.error.actor.fetch', error: new Error('Unavailable') },
          { type: 'Shutdown' },
        ]
      if (snapshot.matches('Saving'))
        return [{ type: 'xstate.done.actor.save', output: undefined }, { type: 'Shutdown' }]
      return []
    },
  })
  const states = new Set(paths.map(({ state }) => String(state.value)))
  assert.deepEqual(states, new Set(['Idle', 'Fetching', 'Saving', 'Ready', 'Failed', 'Closed']))
})
