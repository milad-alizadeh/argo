import { assign, fromPromise, setup } from 'xstate'
import type {
  SessionSummary,
  SessionSummaryList,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
export const SESSION_SYNC_BATCH_SIZE = 50

export const sessionSyncMachine = setup({
  types: {
    input: {} as {
      harness: Harness
      knownNativeIds: string[]
      listSessionSummaries: SessionSummaryList
    },
    context: {} as {
      harness: Harness
      knownNativeIds: string[]
      listSessionSummaries: SessionSummaryList
      records: SessionSummary[]
      processed: number
      skipped: number
      failure: string | null
      fetchAttempts: number
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
          output: SessionSummaryListResult
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
      SessionSummaryListResult,
      {
        knownNativeIds: string[]
        listSessionSummaries: SessionSummaryList
      }
    >(({ input }) =>
      input.listSessionSummaries({
        knownNativeIds: input.knownNativeIds,
      }),
    ),
    save: fromPromise<
      void,
      {
        records: SessionSummary[]
      }
    >(async () => {
      throw new Error('The session sync saver is not configured.')
    }),
  },
  guards: {
    canRetryFetch: ({ context }) => context.fetchAttempts < 2,
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
    }),
    rememberFetched: assign({
      records: ({ event }) =>
        event.type === 'xstate.done.actor.fetch' ? event.output.records : [],
      skipped: ({ event }) => (event.type === 'xstate.done.actor.fetch' ? event.output.skipped : 0),
      failure: null,
    }),
    countFetchAttempt: assign({
      fetchAttempts: ({ context }) => context.fetchAttempts + 1,
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
      failure: null,
    }),
  },
}).createMachine({
  id: 'sessionSync',
  initial: 'Idle',
  context: ({ input }) => ({
    harness: input.harness,
    knownNativeIds: input.knownNativeIds,
    listSessionSummaries: input.listSessionSummaries,
    records: [],
    processed: 0,
    skipped: 0,
    failure: null,
    fetchAttempts: 0,
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
          listSessionSummaries: context.listSessionSummaries,
        }),
        onDone: [
          {
            guard: 'hasFetchedRecords',
            target: 'Saving',
            actions: 'rememberFetched',
          },
          {
            target: 'Ready',
            actions: 'rememberFetched',
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
            actions: 'rememberBatchSaved',
          },
        ],
        // A synchronous SQLite write that failed once fails the same way again.
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
        },
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
