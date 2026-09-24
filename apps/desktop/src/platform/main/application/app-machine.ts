import { type ActorRefFrom, assertEvent, setup } from 'xstate'
import { sessionSupervisorMachine } from '@/domains/sessions/main/live/session-supervisor-machine'
import { sessionIndexActor } from '@/domains/sessions/main/storage/session-index-actor'
import { sessionSyncMachine } from '@/domains/sessions/main/sync/session-sync-machine'
import { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { harnessCatalogLoadActor } from '@/harnesses/catalog/runtime'
import { claudeSessionSync } from '@/harnesses/claude/session/claude-sync'
import {
  codexAppServerMachine,
  codexAppServerProcessActor,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { codexSessionSync } from '@/harnesses/codex/session/codex-sync'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

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
const claudeSyncMachine = sessionSyncMachine.provide({
  actors: {
    sync: claudeSessionSync,
  },
})
const codexSyncMachine = sessionSyncMachine.provide({
  actors: {
    sync: codexSessionSync,
  },
})

export const appMachine = setup({
  types: {
    input: {} as {
      database: DurableDatabase
    },
    context: {} as Record<string, never>,
    events: {} as
      | {
          type: 'Shutdown'
        }
      | {
          type: 'xstate.init'
          input: {
            database: DurableDatabase
          }
        },
  },
  actors: {
    codex: codexMachine,
    catalog: catalogMachine,
    sessions: sessionSupervisorMachine,
    sessionIndex: sessionIndexActor,
    claudeSync: claudeSyncMachine,
    codexSync: codexSyncMachine,
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
      id: 'sessionIndex',
      systemId: 'sessionIndex',
      src: 'sessionIndex',
      input: ({ event }) => {
        assertEvent(event, 'xstate.init')
        return {
          database: event.input.database,
        }
      },
    },
    {
      id: 'claudeSync',
      systemId: 'claudeSync',
      src: 'claudeSync',
      input: ({ event }) => {
        assertEvent(event, 'xstate.init')
        return {}
      },
    },
    {
      id: 'codexSync',
      systemId: 'codexSync',
      src: 'codexSync',
      input: ({ event }) => {
        assertEvent(event, 'xstate.init')
        return {}
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
