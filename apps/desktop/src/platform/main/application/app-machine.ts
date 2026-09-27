import { type ActorRefFrom, assertEvent, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import type { SessionEventJournal } from '@/domains/sessions/main/database/session-event-journal'
import { liveSessionSupervisorMachine } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import type { SessionInteractionBroker } from '@/domains/sessions/main/live/session-interaction-broker'
import { sessionSyncSupervisorMachine } from '@/domains/sessions/main/sync/session-sync-supervisor-machine'
import {
  type HarnessCatalog,
  harnessCatalogMachine,
} from '@/harnesses/catalog/harness-catalog-machine'
import { codexAppServerMachine } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { type HarnessRegistry, readHarnessCatalog } from '@/harnesses/registry'

export function createAppMachine(registry: HarnessRegistry) {
  const catalogMachine = harnessCatalogMachine.provide({
    actors: {
      loadCatalog: fromPromise<HarnessCatalog>(() => readHarnessCatalog(registry)),
    },
  })
  return setup({
    types: {
      input: {} as {
        database: Database
        sessionSyncStatus: SessionSyncStatusStore
        codexSessionSyncStatus: SessionSyncStatusStore
        sessionEventJournal?: SessionEventJournal
        sessionInteractionBroker?: SessionInteractionBroker
      },
      context: {} as Record<string, never>,
      events: {} as
        | {
            type: 'Shutdown'
          }
        | {
            type: 'xstate.init'
            input: {
              database: Database
              sessionSyncStatus: SessionSyncStatusStore
              codexSessionSyncStatus: SessionSyncStatusStore
              sessionEventJournal?: SessionEventJournal
              sessionInteractionBroker?: SessionInteractionBroker
            }
          },
    },
    actors: {
      codex: codexAppServerMachine,
      catalog: catalogMachine,
      sessions: liveSessionSupervisorMachine,
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
        input: ({ event }) => {
          assertEvent(event, 'xstate.init')
          return {
            database: event.input.database,
            journal: event.input.sessionEventJournal,
            interactions: event.input.sessionInteractionBroker,
          }
        },
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
