// The app's Ticket scans: one per scope at a time, and a request during a scan runs once after it.
import { type ActorRefFrom, enqueueActions, setup, stopChild } from 'xstate'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type { TicketErrorCode } from '@/domains/tickets/contract/contract'
import { TICKET_POLL_PROOF_ENV } from './proof-protocol'
import { type TicketSearchRequest, ticketSearchMachine } from './ticket-search-machine'
import {
  type TicketSyncDependencies,
  type TicketSyncRequest,
  ticketSyncMachine,
} from './ticket-sync-machine'

export type TicketSyncTiming = {
  // The wait after a scan that read every page.
  pollMs: number
  // The wait after a first failed scan, doubled for each failure after it up to `retryCapMs`.
  retryMs: number
  retryCapMs: number
}

export const TICKET_SYNC_TIMING: TicketSyncTiming = {
  pollMs: 60_000,
  retryMs: 5_000,
  retryCapMs: 300_000,
}

// The Ticket proof's shorter poll, read only while the proof runs; a malformed one is reported.
export function ticketSyncTiming(
  proofEnabled: boolean,
  value = process.env[TICKET_POLL_PROOF_ENV],
): TicketSyncTiming {
  if (!proofEnabled || value === undefined) return TICKET_SYNC_TIMING
  const pollMs = Number(value)
  if (!Number.isInteger(pollMs) || pollMs <= 0) {
    console.warn(`${TICKET_POLL_PROOF_ENV} is not a positive whole number of milliseconds.`)
    return TICKET_SYNC_TIMING
  }
  return {
    pollMs,
    retryMs: pollMs,
    retryCapMs: pollMs,
  }
}

// Whether another scan could succeed without a person acting; any other failure waits for one.
const RETRYABLE: Record<TicketErrorCode, boolean> = {
  'access-denied': false,
  'invalid-request': false,
  'unsupported-version': false,
  'invalid-response': true,
  'connection-lost': true,
  'missing-project': false,
  'not-connected': false,
  'invalid-scope': false,
  'missing-account': false,
  'account-expired': false,
  'account-revoked': false,
  'repository-not-visible': false,
  'issues-disabled': false,
  'team-not-visible': false,
  'ticket-not-found': false,
  'ticket-not-writable': false,
  'status-unknown': false,
  'github-unreachable': true,
  'rate-limited': true,
  'linear-unreachable': true,
  'linear-rate-limited': true,
  'grant-unreadable': false,
  'storage-invalid': false,
  'storage-unavailable': true,
  'storage-not-written': true,
}

export type TicketSyncSupervisorInput = TicketSyncDependencies & {
  timing: TicketSyncTiming
}

export type TicketSyncSupervisorCommand =
  | {
      type: 'Sync'
      request: TicketSyncRequest
    }
  // A provider search for a query the saved Tickets may not cover; one per query runs at a time.
  | {
      type: 'Search'
      request: TicketSearchRequest
    }
  // A screen showing the scope's Tickets; each watcher is one open view.
  | {
      type: 'Watch'
      watcherId: string
      request: TicketSyncRequest
    }
  | {
      type: 'Unwatch'
      watcherId: string
    }
  | {
      type: 'Visibility'
      visible: boolean
    }

type FinishedEvent = {
  type: `xstate.done.actor.${string}`
  actorId: string
  output: {
    failure: TicketErrorCode | null
  }
}

type DueEvent = {
  type: 'Due'
  key: string
}

const keyOf = ({ provider, scope }: TicketScopeTarget) => `ticket-sync:${provider}:${scope}`
const SEARCH_PREFIX = 'ticket-search:'
const searchKeyOf = ({ provider, scope, query }: TicketSearchRequest) =>
  `${SEARCH_PREFIX}${JSON.stringify([
    provider,
    scope,
    query,
  ])}`
const dueId = (key: string) => `due:${key}`

type Watchers = Record<string, TicketSyncRequest>

// The newest watcher's request for each watched scope.
const watchedScopes = (watchers: Watchers) =>
  new Map(
    Object.values(watchers).map((request) => [
      keyOf(request),
      request,
    ]),
  )

export function nextScanDelay(timing: TicketSyncTiming, failures: number): number {
  if (failures === 0) return timing.pollMs
  return Math.min(timing.retryMs * 2 ** (failures - 1), timing.retryCapMs)
}

export const ticketSyncSupervisorMachine = setup({
  types: {
    input: {} as TicketSyncSupervisorInput,
    context: {} as {
      dependencies: TicketSyncDependencies
      timing: TicketSyncTiming
      active: Record<string, true>
      // The latest request that arrived during a scope's scan.
      pending: Record<string, TicketSyncRequest>
      watchers: Watchers
      visible: boolean
      // Each scope's failed scans since its last complete one.
      failures: Record<string, number>
    },
    events: {} as
      | TicketSyncSupervisorCommand
      | FinishedEvent
      | DueEvent
      | {
          type: 'Shutdown'
        },
  },
  actors: {
    sync: ticketSyncMachine,
    search: ticketSearchMachine,
  },
  actions: {
    dispatch: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Sync') return
      const key = keyOf(event.request)
      if (context.active[key]) {
        enqueue.assign({
          pending: {
            ...context.pending,
            [key]: event.request,
          },
        })
        return
      }
      enqueue.cancel(dueId(key))
      const { accountId, provider, scope } = event.request
      enqueue.spawnChild('sync', {
        id: key,
        input: {
          dependencies: context.dependencies,
          target: {
            provider,
            scope,
            kind: 'active',
          },
          accountId,
        },
      })
      enqueue.assign({
        active: {
          ...context.active,
          [key]: true,
        },
      })
    }),
    // A search already running for the query is the one that answers.
    search: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Search') return
      const key = searchKeyOf(event.request)
      if (context.active[key]) return
      const { accountId, provider, scope, query } = event.request
      enqueue.spawnChild('search', {
        id: key,
        input: {
          dependencies: context.dependencies,
          target: {
            provider,
            scope,
            query,
          },
          accountId,
        },
      })
      enqueue.assign({
        active: {
          ...context.active,
          [key]: true,
        },
      })
    }),
    // A scope already watched or scanning shares that scan rather than queueing another.
    watch: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Watch') return
      const key = keyOf(event.request)
      const shared = watchedScopes(context.watchers).has(key) || context.active[key]
      enqueue.assign({
        watchers: {
          ...context.watchers,
          [event.watcherId]: event.request,
        },
      })
      if (!shared)
        enqueue.raise({
          type: 'Sync',
          request: event.request,
        })
    }),
    unwatch: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Unwatch') return
      const { [event.watcherId]: request, ...watchers } = context.watchers
      if (request === undefined) return
      const key = keyOf(request)
      const { [key]: _failures, ...failures } = context.failures
      const watched = watchedScopes(watchers).has(key)
      // The last view leaving a scope ends its timer and its backoff.
      enqueue.assign({
        watchers,
        failures: watched ? context.failures : failures,
      })
      if (!watched) enqueue.cancel(dueId(key))
    }),
    // A window that returns scans every watched scope now; a hidden one stops the timers.
    changeVisibility: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Visibility' || event.visible === context.visible) return
      enqueue.assign({
        visible: event.visible,
      })
      for (const [key, request] of watchedScopes(context.watchers)) {
        if (event.visible)
          enqueue.raise({
            type: 'Sync',
            request,
          })
        else enqueue.cancel(dueId(key))
      }
    }),
    due: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Due' || !context.visible) return
      const request = watchedScopes(context.watchers).get(event.key)
      if (request !== undefined)
        enqueue.raise({
          type: 'Sync',
          request,
        })
    }),
    release: enqueueActions(
      (
        { context, enqueue },
        {
          key,
          failure,
        }: {
          key: string
          failure: TicketErrorCode | null
        },
      ) => {
        enqueue(stopChild(key))
        const { [key]: _finished, ...active } = context.active
        // A finished search neither backs off nor polls; the next query asks again.
        if (key.startsWith(SEARCH_PREFIX)) {
          enqueue.assign({
            active,
          })
          return
        }
        const { [key]: replay, ...pending } = context.pending
        const failures = failure === null ? 0 : (context.failures[key] ?? 0) + 1
        enqueue.assign({
          active,
          pending,
          failures: {
            ...context.failures,
            [key]: failures,
          },
        })
        if (replay !== undefined) {
          enqueue.raise({
            type: 'Sync',
            request: replay,
          })
          return
        }
        const retryable = failure === null || RETRYABLE[failure]
        if (retryable && context.visible && watchedScopes(context.watchers).has(key))
          enqueue.raise(
            {
              type: 'Due',
              key,
            },
            {
              id: dueId(key),
              delay: nextScanDelay(context.timing, failures),
            },
          )
      },
    ),
  },
}).createMachine({
  id: 'ticketSyncSupervisor',
  initial: 'Running',
  context: ({ input: { timing, ...dependencies } }) => ({
    dependencies,
    timing,
    active: {},
    pending: {},
    watchers: {},
    visible: false,
    failures: {},
  }),
  states: {
    Running: {
      on: {
        Sync: {
          actions: 'dispatch',
        },
        Search: {
          actions: 'search',
        },
        Watch: {
          actions: 'watch',
        },
        Unwatch: {
          actions: 'unwatch',
        },
        Visibility: {
          actions: 'changeVisibility',
        },
        Due: {
          actions: 'due',
        },
        'xstate.done.actor.*': {
          actions: {
            type: 'release',
            params: ({ event }) => ({
              key: event.actorId,
              failure: event.output.failure,
            }),
          },
        },
        Shutdown: 'Closed',
      },
    },
    Closed: {
      type: 'final',
    },
  },
})

export type TicketSyncSupervisorActor = ActorRefFrom<typeof ticketSyncSupervisorMachine>
