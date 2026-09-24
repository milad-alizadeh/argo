import { type ActorRefFrom, assign, fromPromise, setup } from 'xstate'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { sessionIndexActor } from '../storage/session-index-actor'

export type SessionSyncInput = Record<string, never>

export type SessionSyncJobInput = {
  cursor: string | null
  generation: number
  page: number
}

export type SessionSyncResult = {
  complete: boolean
  cursor: string | null
  generation: number
  indexedCount: number
  invalidRecordCount: number
  page: number
  sessions: SessionIngestion[]
}

export const sessionSyncPageSize = 50
export const sessionSyncMaxRetries = 3

function isSessionSyncResult(value: unknown): value is SessionSyncResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'complete' in value &&
    typeof value.complete === 'boolean' &&
    'cursor' in value &&
    (typeof value.cursor === 'string' || value.cursor === null) &&
    'generation' in value &&
    typeof value.generation === 'number' &&
    'indexedCount' in value &&
    typeof value.indexedCount === 'number' &&
    'invalidRecordCount' in value &&
    typeof value.invalidRecordCount === 'number' &&
    'page' in value &&
    typeof value.page === 'number' &&
    'sessions' in value &&
    Array.isArray(value.sessions)
  )
}

export const sessionSyncMachine = setup({
  types: {
    input: {} as SessionSyncInput,
    context: {} as {
      cursor: string | null
      generation: number
      indexedCount: number
      invalidRecordCount: number
      page: number
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
        },
  },
  actors: {
    sync: fromPromise<SessionSyncResult, SessionSyncJobInput>(async () => {
      throw new Error('The Harness must provide Session sync.')
    }),
  },
  guards: {
    canRetry: ({ context }) => context.retryCount < sessionSyncMaxRetries,
    isCurrentCompleteGeneration: ({ context, event }) =>
      'output' in event &&
      isSessionSyncResult(event.output) &&
      event.output.generation === context.generation &&
      event.output.complete,
    isCurrentGeneration: ({ context, event }) =>
      'output' in event &&
      isSessionSyncResult(event.output) &&
      event.output.generation === context.generation,
  },
  actions: {
    rememberResult: assign(({ event }) => {
      if (!('output' in event) || !isSessionSyncResult(event.output)) return {}
      return {
        cursor: event.output.complete ? null : event.output.cursor,
        indexedCount: event.output.indexedCount,
        invalidRecordCount: event.output.invalidRecordCount,
        page: event.output.complete ? 0 : event.output.page + 1,
        failure: null,
        refreshedAt: Date.now(),
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
    restartAtRecent: assign(({ context }) => ({
      cursor: null,
      generation: context.generation + 1,
      page: 0,
      retryCount: 0,
    })),
    beginRefresh: assign(({ context }) => ({
      generation: context.generation + 1,
      retryCount: 0,
    })),
    indexResult: ({ event, self }) => {
      if (!('output' in event) || !isSessionSyncResult(event.output)) return
      if (event.output.sessions.length === 0) return
      const index = self.system.get('sessionIndex') as ActorRefFrom<typeof sessionIndexActor>
      index.send({
        type: 'Index',
        sessions: event.output.sessions,
      })
    },
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
    page: 0,
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
          page: context.page,
        }),
        onDone: [
          {
            guard: 'isCurrentCompleteGeneration',
            target: 'Waiting',
            actions: [
              'indexResult',
              'rememberResult',
            ],
          },
          {
            guard: 'isCurrentGeneration',
            target: 'Syncing',
            reenter: true,
            actions: [
              'indexResult',
              'rememberResult',
            ],
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
            target: 'Waiting',
            actions: 'rememberFailure',
          },
        ],
      },
      on: {
        'Priority sync': {
          target: 'Syncing',
          reenter: true,
          actions: 'restartAtRecent',
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
          actions: 'restartAtRecent',
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
          actions: 'restartAtRecent',
        },
      },
    },
  },
})
