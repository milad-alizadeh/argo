import { assign, fromPromise, setup } from 'xstate'
import { z } from 'zod'

export type SessionSyncInput = Record<string, never>

export type SessionSyncJobInput = {
  cursor: string | null
  generation: number
  priorityNativeId: string | null
}

export const sessionSyncResultSchema = z.strictObject({
  cursor: z.string().nullable(),
  generation: z.number().int().nonnegative(),
  indexedCount: z.number().int().nonnegative(),
  invalidRecordCount: z.number().int().nonnegative(),
})
export type SessionSyncResult = z.infer<typeof sessionSyncResultSchema>

export const sessionSyncPageSize = 50
export const sessionSyncMaxRetries = 3

function isSessionSyncResult(value: unknown): value is SessionSyncResult {
  return sessionSyncResultSchema.safeParse(value).success
}

export const sessionSyncMachine = setup({
  types: {
    input: {} as SessionSyncInput,
    context: {} as {
      cursor: string | null
      generation: number
      indexedCount: number
      invalidRecordCount: number
      priorityNativeId: string | null
      failure: string | null
      refreshedAt: number | null
      retryCount: number
    },
    events: {} as
      | {
          type: 'Refresh'
        }
      | {
          type: 'Priority sync'
          nativeId: string
        },
  },
  actors: {
    sync: fromPromise<SessionSyncResult, SessionSyncJobInput>(async () => {
      throw new Error('The Harness must provide Session sync.')
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < sessionSyncMaxRetries,
    isPriority: ({ context }) => context.priorityNativeId !== null,
    isCurrentPriority: ({ context, event }) =>
      'output' in event &&
      isSessionSyncResult(event.output) &&
      event.output.generation === context.generation &&
      context.priorityNativeId !== null,
    isCurrentCompleteGeneration: ({ context, event }) =>
      'output' in event &&
      isSessionSyncResult(event.output) &&
      event.output.generation === context.generation &&
      event.output.cursor === null,
    isCurrentGeneration: ({ context, event }) =>
      'output' in event &&
      isSessionSyncResult(event.output) &&
      event.output.generation === context.generation,
  },
  actions: {
    rememberResult: assign(({ context, event }) => {
      if (!('output' in event) || !isSessionSyncResult(event.output)) return {}
      return {
        cursor: context.priorityNativeId === null ? event.output.cursor : context.cursor,
        indexedCount: event.output.indexedCount,
        invalidRecordCount: event.output.invalidRecordCount,
        failure: null,
        refreshedAt: Math.max(Date.now(), (context.refreshedAt ?? 0) + 1),
        retryCount: 0,
      }
    }),
    rememberFailure: assign(({ context, event }) => ({
      failure: 'error' in event ? String(event.error) : context.failure,
      retryCount: context.retryCount + 1,
    })),
    advanceGeneration: assign(({ context }) => ({
      generation: context.generation + 1,
    })),
    prioritize: assign(({ context, event }) => ({
      generation: context.generation + 1,
      priorityNativeId: event.type === 'Priority sync' ? event.nativeId : null,
      retryCount: 0,
    })),
    clearPriority: assign({
      priorityNativeId: null,
    }),
    beginRefresh: assign(({ context }) => ({
      cursor: null,
      generation: context.generation + 1,
      retryCount: 0,
    })),
  },
  delays: {
    poll: 30_000,
    retry: 5_000,
  },
}).createMachine({
  id: 'sessionSync',
  initial: 'Syncing',
  context: () => ({
    cursor: null,
    generation: 0,
    indexedCount: 0,
    invalidRecordCount: 0,
    priorityNativeId: null,
    failure: null,
    refreshedAt: null,
    retryCount: 0,
  }),
  states: {
    Syncing: {
      invoke: {
        src: 'sync',
        input: ({ context }) => ({
          cursor: context.cursor,
          generation: context.generation,
          priorityNativeId: context.priorityNativeId,
        }),
        onDone: [
          {
            guard: 'isCurrentPriority',
            target: 'Syncing',
            reenter: true,
            actions: [
              'rememberResult',
              'clearPriority',
            ],
          },
          {
            guard: 'isCurrentCompleteGeneration',
            target: 'Waiting',
            actions: 'rememberResult',
          },
          {
            guard: 'isCurrentGeneration',
            target: 'Syncing',
            reenter: true,
            actions: 'rememberResult',
          },
          {
            target: 'Waiting',
          },
        ],
        onError: [
          {
            guard: 'canRetry',
            target: 'Retrying',
            actions: 'rememberFailure',
          },
          {
            guard: 'isPriority',
            target: 'Syncing',
            reenter: true,
            actions: [
              'rememberFailure',
              'clearPriority',
            ],
          },
          {
            target: 'Waiting',
            actions: 'rememberFailure',
          },
        ],
      },
      on: {
        'Priority sync': {
          target: 'Syncing',
          reenter: true,
          actions: 'prioritize',
        },
      },
    },
    Waiting: {
      after: {
        poll: {
          target: 'Syncing',
          actions: 'beginRefresh',
        },
      },
      on: {
        Refresh: {
          target: 'Syncing',
          actions: 'beginRefresh',
        },
        'Priority sync': {
          target: 'Syncing',
          actions: 'prioritize',
        },
      },
    },
    Retrying: {
      after: {
        retry: {
          target: 'Syncing',
          actions: 'advanceGeneration',
        },
      },
      on: {
        Refresh: {
          target: 'Syncing',
          actions: 'beginRefresh',
        },
        'Priority sync': {
          target: 'Syncing',
          actions: 'prioritize',
        },
      },
    },
  },
})
