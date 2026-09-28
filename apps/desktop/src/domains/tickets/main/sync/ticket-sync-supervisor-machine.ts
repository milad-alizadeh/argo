// The app's Ticket scans: one per scope at a time, and a request during a scan runs once after it.
import { type ActorRefFrom, enqueueActions, setup, stopChild } from 'xstate'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import {
  type TicketSyncDependencies,
  type TicketSyncRequest,
  ticketSyncMachine,
} from './ticket-sync-machine'

export type TicketSyncSupervisorCommand = {
  type: 'Sync'
  request: TicketSyncRequest
}

type FinishedEvent = {
  type: `xstate.done.actor.${string}`
  actorId: string
}

const keyOf = ({ provider, scope }: TicketScopeTarget) => `ticket-sync:${provider}:${scope}`

export const ticketSyncSupervisorMachine = setup({
  types: {
    input: {} as TicketSyncDependencies,
    context: {} as {
      dependencies: TicketSyncDependencies
      active: Record<string, true>
      // The latest request that arrived during a scope's scan.
      pending: Record<string, TicketSyncRequest>
    },
    events: {} as
      | TicketSyncSupervisorCommand
      | FinishedEvent
      | {
          type: 'Shutdown'
        },
  },
  actors: {
    sync: ticketSyncMachine,
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
    release: enqueueActions(
      (
        { context, enqueue },
        {
          key,
        }: {
          key: string
        },
      ) => {
        enqueue(stopChild(key))
        const { [key]: _finished, ...active } = context.active
        const { [key]: replay, ...pending } = context.pending
        enqueue.assign({
          active,
          pending,
        })
        if (replay !== undefined)
          enqueue.raise({
            type: 'Sync',
            request: replay,
          })
      },
    ),
  },
}).createMachine({
  id: 'ticketSyncSupervisor',
  initial: 'Running',
  context: ({ input }) => ({
    dependencies: input,
    active: {},
    pending: {},
  }),
  states: {
    Running: {
      on: {
        Sync: {
          actions: 'dispatch',
        },
        'xstate.done.actor.*': {
          actions: {
            type: 'release',
            params: ({ event }) => ({
              key: event.actorId,
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
