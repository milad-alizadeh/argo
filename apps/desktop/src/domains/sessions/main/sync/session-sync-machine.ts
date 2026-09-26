import { assign, fromPromise, setup } from 'xstate'
import type { Harness } from '@/harnesses/harness'
import type { SessionUpsertInput } from '../database/session-upsert'

export type SyncedSessionRecord = Omit<SessionUpsertInput, 'harness'>

export type SyncResult = {
  records: SyncedSessionRecord[]
  skipped: number
}
export const SESSION_SYNC_BATCH_SIZE = 50

export const sessionSyncMachine = setup({
  types: {
    input: {} as {
      harness: Harness
      knownNativeIds: string[]
    },
    context: {} as {
      harness: Harness
      knownNativeIds: string[]
      records: SyncedSessionRecord[]
      processed: number
      skipped: number
      failure: string | null
      lastSuccessfulSyncAt: string | null
      fetchAttempts: number
      saveAttempts: number
    },
    events: {} as
      | {
          type: 'Start'
        }
      | {
          type: 'Shutdown'
        }
      | {
          type: 'xstate.done.actor.fetch'
          output: SyncResult
        }
      | {
          type: 'xstate.error.actor.fetch'
          error: unknown
        }
      | {
          type: 'xstate.done.actor.save'
          output: undefined
        }
      | {
          type: 'xstate.error.actor.save'
          error: unknown
        },
  },
  actors: {
    fetch: fromPromise<
      SyncResult,
      {
        knownNativeIds: string[]
      }
    >(async () => {
      throw new Error('The session sync reader is not configured.')
    }),
    save: fromPromise<
      void,
      {
        records: SyncedSessionRecord[]
      }
    >(async () => {
      throw new Error('The session sync saver is not configured.')
    }),
  },
  guards: {
    canRetryFetch: ({ context }) => context.fetchAttempts < 2,
    canRetrySave: ({ context }) => context.saveAttempts < 2,
    hasFetchedRecords: ({ event }) =>
      event.type === 'xstate.done.actor.fetch' && event.output.records.length > 0,
    hasMoreBatches: ({ context }) =>
      context.processed +
        Math.min(SESSION_SYNC_BATCH_SIZE, context.records.length - context.processed) <
      context.records.length,
  },
  actions: {
    reset: assign({
      records: [],
      processed: 0,
      skipped: 0,
      failure: null,
      fetchAttempts: 0,
      saveAttempts: 0,
    }),
    rememberFetched: assign({
      records: ({ event }) =>
        event.type === 'xstate.done.actor.fetch' ? event.output.records : [],
      skipped: ({ event }) => (event.type === 'xstate.done.actor.fetch' ? event.output.skipped : 0),
    }),
    countFetchAttempt: assign({
      fetchAttempts: ({ context }) => context.fetchAttempts + 1,
    }),
    countSaveAttempt: assign({
      saveAttempts: ({ context }) => context.saveAttempts + 1,
    }),
    rememberFailure: assign({
      failure: ({ event }) => {
        if (event.type === 'xstate.error.actor.fetch' || event.type === 'xstate.error.actor.save')
          return String(event.error)
        return 'Session sync failed.'
      },
    }),
    rememberBatchSaved: assign({
      processed: ({ context }) =>
        context.processed +
        Math.min(SESSION_SYNC_BATCH_SIZE, context.records.length - context.processed),
      saveAttempts: 0,
      failure: null,
    }),
    rememberCompleted: assign({
      lastSuccessfulSyncAt: () => new Date().toISOString(),
      failure: null,
    }),
  },
}).createMachine({
  id: 'sessionSync',
  initial: 'Idle',
  context: ({ input }) => ({
    harness: input.harness,
    knownNativeIds: input.knownNativeIds,
    records: [],
    processed: 0,
    skipped: 0,
    failure: null,
    lastSuccessfulSyncAt: null,
    fetchAttempts: 0,
    saveAttempts: 0,
  }),
  on: {
    Shutdown: '.Closed',
  },
  states: {
    Idle: {
      on: {
        Start: {
          target: 'Fetching',
          actions: 'reset',
        },
      },
    },
    Fetching: {
      invoke: {
        id: 'fetch',
        src: 'fetch',
        input: ({ context }) => ({
          knownNativeIds: context.knownNativeIds,
        }),
        onDone: [
          {
            guard: 'hasFetchedRecords',
            target: 'Saving',
            actions: 'rememberFetched',
          },
          {
            target: 'Ready',
            actions: [
              'rememberFetched',
              'rememberCompleted',
            ],
          },
        ],
        onError: [
          {
            guard: 'canRetryFetch',
            target: 'Fetching',
            reenter: true,
            actions: [
              'countFetchAttempt',
              'rememberFailure',
            ],
          },
          {
            target: 'Failed',
            actions: 'rememberFailure',
          },
        ],
      },
    },
    Saving: {
      invoke: {
        id: 'save',
        src: 'save',
        input: ({ context }) => ({
          records: context.records.slice(
            context.processed,
            context.processed + SESSION_SYNC_BATCH_SIZE,
          ),
        }),
        onDone: [
          {
            guard: 'hasMoreBatches',
            target: 'Saving',
            reenter: true,
            actions: 'rememberBatchSaved',
          },
          {
            target: 'Ready',
            actions: [
              'rememberBatchSaved',
              'rememberCompleted',
            ],
          },
        ],
        onError: [
          {
            guard: 'canRetrySave',
            target: 'Saving',
            reenter: true,
            actions: [
              'countSaveAttempt',
              'rememberFailure',
            ],
          },
          {
            target: 'Failed',
            actions: 'rememberFailure',
          },
        ],
      },
    },
    Ready: {
      type: 'final',
    },
    Failed: {
      type: 'final',
    },
    Closed: {
      type: 'final',
    },
  },
})
