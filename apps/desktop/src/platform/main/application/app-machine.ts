import { type ActorRefFrom, assertEvent, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import { createLiveSessionSupervisorMachine } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import type { SessionEventJournal } from '@/domains/sessions/main/live/session-event-journal'
import type { SessionInteractionBroker } from '@/domains/sessions/main/live/session-interaction-broker'
import { sessionSyncSupervisorMachine } from '@/domains/sessions/main/sync/session-sync-supervisor-machine'
import {
  type HarnessCatalog,
  harnessCatalogMachine,
} from '@/harnesses/catalog/harness-catalog-machine'
import { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { type HarnessRegistry, readHarnessCatalog } from '@/harnesses/registry'

type AppDependencies = {
  database: Database
  sessionSyncStatus: SessionSyncStatusStore
  codexSessionSyncStatus: SessionSyncStatusStore
  sessionEventJournal?: SessionEventJournal
  sessionInteractionBroker?: SessionInteractionBroker
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
      codex: codexAppServerMachine,
      catalog: catalogMachine,
      sessions: createLiveSessionSupervisorMachine({
        database: dependencies.database,
        journal: dependencies.sessionEventJournal,
        interactions: dependencies.sessionInteractionBroker,
      }),
      sessionSync: sessionSyncSupervisorMachine,
    },
  }).createMachine({
    id: 'application',
    initial: 'Running',
    context: {},
    invoke: [
      {
        id: 'codex',
        systemId: 'codex',
        src: 'codex',
        input: {},
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
            status: {
              claude: event.input.sessionSyncStatus,
              codex: event.input.codexSessionSyncStatus,
            },
          }
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
