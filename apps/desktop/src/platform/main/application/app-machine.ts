import { type ActorRefFrom, assertEvent, fromCallback, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionEventJournal, SessionInteractionBroker } from '@/domains/sessions/main/live'
import { createLiveSessionSupervisorMachine } from '@/domains/sessions/main/live'
import type { SessionSyncStatusStore } from '@/domains/sessions/main/session-sync-status'
import { sessionSyncSupervisorMachine } from '@/domains/sessions/main/sync'
import {
  type TicketOperationSupervisorInput,
  ticketOperationSupervisorMachine,
} from '@/domains/tickets/main/operations'
import {
  type TicketSyncSupervisorInput,
  ticketSyncSupervisorMachine,
} from '@/domains/tickets/main/sync'
import type { Harness } from '@/harnesses/harness'
import type { HarnessCatalog } from '@/harnesses/harness-catalog'
import {
  type HarnessRegistry,
  readHarnessCatalog,
  shutdownHarnessRegistry,
} from '@/harnesses/registry'
import { harnessCatalogMachine } from '../harness-catalog/harness-catalog-machine'

type AppDependencies = {
  database: Database
  sessionSyncStatus: Record<Harness, SessionSyncStatusStore>
  sessionEventJournal?: SessionEventJournal
  sessionInteractionBroker?: SessionInteractionBroker
  ticketSync: TicketSyncSupervisorInput
  ticketOperations: TicketOperationSupervisorInput
}

export function createAppMachine(registry: HarnessRegistry, dependencies: AppDependencies) {
  const catalogMachine = harnessCatalogMachine.provide({
    actors: {
      loadCatalog: fromPromise<HarnessCatalog>(() => readHarnessCatalog(registry)),
    },
  })
  return setup({
    types: {
      input: {} as AppDependencies,
      context: {} as Record<string, never>,
      events: {} as
        | {
            type: 'Shutdown'
          }
        | {
            type: 'xstate.init'
            input: AppDependencies
          },
    },
    actors: {
      harnessClients: fromCallback(() => () => shutdownHarnessRegistry(registry)),
      catalog: catalogMachine,
      sessions: createLiveSessionSupervisorMachine({
        database: dependencies.database,
        registry,
        journal: dependencies.sessionEventJournal,
        interactions: dependencies.sessionInteractionBroker,
      }),
      sessionSync: sessionSyncSupervisorMachine,
      ticketSync: ticketSyncSupervisorMachine,
      ticketOperations: ticketOperationSupervisorMachine,
    },
  }).createMachine({
    id: 'application',
    initial: 'Running',
    context: {},
    invoke: [
      {
        id: 'harnessClients',
        src: 'harnessClients',
      },
      {
        id: 'catalog',
        systemId: 'catalog',
        src: 'catalog',
      },
      {
        id: 'sessions',
        systemId: 'sessions',
        src: 'sessions',
      },
      {
        id: 'sessionSync',
        systemId: 'sessionSync',
        src: 'sessionSync',
        input: ({ event }) => {
          assertEvent(event, 'xstate.init')
          return {
            database: event.input.database,
            harnesses: registry,
            status: event.input.sessionSyncStatus,
          }
        },
      },
      {
        id: 'ticketSync',
        systemId: 'ticketSync',
        src: 'ticketSync',
        input: ({ event }) => {
          assertEvent(event, 'xstate.init')
          return event.input.ticketSync
        },
      },
      {
        id: 'ticketOperations',
        systemId: 'ticketOperations',
        src: 'ticketOperations',
        input: ({ event }) => {
          assertEvent(event, 'xstate.init')
          return event.input.ticketOperations
        },
      },
    ],
    states: {
      Running: {
        on: {
          Shutdown: 'Closed',
        },
      },
      Closed: {
        type: 'final',
      },
    },
  })
}

export type AppActor = ActorRefFrom<ReturnType<typeof createAppMachine>>
