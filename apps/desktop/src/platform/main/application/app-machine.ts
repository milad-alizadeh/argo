import { type ActorRefFrom, assertEvent, setup } from 'xstate'
import type { Database } from '@/database/database'
import { liveSessionSupervisorMachine } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import type { SessionSyncStatusStore } from '@/domains/sessions/main/sync/session-sync-status'
import { sessionSyncWorkerMachine } from '@/domains/sessions/main/sync/session-sync-worker-machine'
import { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { harnessCatalogLoadActor } from '@/harnesses/catalog/runtime'
import {
  codexAppServerMachine,
  codexAppServerProcessActor,
} from '@/harnesses/codex/app-server/codex-app-server-machine'

const codexMachine = codexAppServerMachine.provide({
  actors: {
    processActor: codexAppServerProcessActor,
  },
})
const catalogMachine = harnessCatalogMachine.provide({
  actors: {
    loadCatalog: harnessCatalogLoadActor,
  },
})

export const appMachine = setup({
  types: {
    input: {} as {
      database: Database
      databasePath: string | null
      sessionSyncStatus: SessionSyncStatusStore
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
            databasePath: string
            sessionSyncStatus: SessionSyncStatusStore
          }
        },
  },
  actors: {
    codex: codexMachine,
    catalog: catalogMachine,
    sessions: liveSessionSupervisorMachine,
    sessionSync: sessionSyncWorkerMachine,
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
      input: {
        executable: null,
      },
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
          databasePath: event.input.databasePath,
          status: event.input.sessionSyncStatus,
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

export type AppActor = ActorRefFrom<typeof appMachine>
