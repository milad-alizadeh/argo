import { assign, fromPromise, setup } from 'xstate'
import type {
  SessionSubagentLink,
  SessionSummary,
  SessionSummaryList,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
export const SESSION_SYNC_BATCH_SIZE = 50

// The stored Sessions and parented Subagents one sync lists against, and the Harness's listing.
export type SessionSyncListing = {
  knownNativeIds: string[]
  knownSubagentNativeIds: string[]
  listSessionSummaries: SessionSummaryList
}

export const sessionSyncMachine = setup({
  types: {
    input: {} as SessionSyncListing & {
      harness: Harness
    },
    context: {} as SessionSyncListing & {
      harness: Harness
      records: SessionSummary[]
      subagents: SessionSubagentLink[]
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
    fetch: fromPromise<SessionSummaryListResult, SessionSyncListing>(({ input }) =>
      input.listSessionSummaries({
        knownNativeIds: input.knownNativeIds,
        knownSubagentNativeIds: input.knownSubagentNativeIds,
      }),
    ),
    save: fromPromise<
      void,
      {
        records: SessionSummary[]
        subagents: SessionSubagentLink[]
      }
    >(async () => {
      throw new Error('The session sync saver is not configured.')
    }),
  },
  guards: {
    canRetryFetch: ({ context }) => context.fetchAttempts < 2,
    hasFetchedRecords: ({ event }) =>
      event.type === 'xstate.done.actor.fetch' &&
      (event.output.records.length > 0 || (event.output.subagents?.length ?? 0) > 0),
    hasMoreBatches: ({ context }) =>
      context.processed +
        Math.min(SESSION_SYNC_BATCH_SIZE, context.records.length - context.processed) <
      context.records.length,
  },
  actions: {
    reset: assign({
      records: [],
      subagents: [],
      processed: 0,
      skipped: 0,
      failure: null,
      fetchAttempts: 0,
    }),
    rememberFetched: assign({
      records: ({ event }) =>
        event.type === 'xstate.done.actor.fetch' ? event.output.records : [],
      subagents: ({ event }) =>
        event.type === 'xstate.done.actor.fetch' ? (event.output.subagents ?? []) : [],
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
    knownSubagentNativeIds: input.knownSubagentNativeIds,
    listSessionSummaries: input.listSessionSummaries,
    records: [],
    subagents: [],
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
          knownSubagentNativeIds: context.knownSubagentNativeIds,
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
          subagents:
            context.processed +
              Math.min(SESSION_SYNC_BATCH_SIZE, context.records.length - context.processed) >=
            context.records.length
              ? context.subagents
              : [],
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
        // A save already waited out busy_timeout, so a failure stops the scan until the next Refresh.
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
