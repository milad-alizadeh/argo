import { type ActorRefFrom, assertEvent, setup } from 'xstate'
import { sessionSupervisorMachine } from '@/domains/sessions/main/live/session-supervisor-machine'
import { sessionSyncMachine } from '@/domains/sessions/main/sync/session-sync-machine'
import { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { harnessCatalogLoadActor } from '@/harnesses/catalog/runtime'
import { createClaudeSessionSync } from '@/harnesses/claude/session/claude-sync'
import {
  codexAppServerMachine,
  codexAppServerProcessActor,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { createCodexSessionSync } from '@/harnesses/codex/session/codex-sync'
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
export const appMachine = setup({
  types: {
    input: {} as {
      database: DurableDatabase
      databasePath: string
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
            databasePath: string
          }
        },
  },
  actors: {
    codex: codexMachine,
    catalog: catalogMachine,
    sessions: sessionSupervisorMachine,
    claudeSync: sessionSyncMachine,
    codexSync: sessionSyncMachine,
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

export function createApplicationMachine(databasePath: string) {
  return appMachine.provide({
    actors: {
      claudeSync: sessionSyncMachine.provide({
        actors: {
          sync: createClaudeSessionSync(databasePath),
        },
      }),
      codexSync: sessionSyncMachine.provide({
        actors: {
          sync: createCodexSessionSync(databasePath),
        },
      }),
    },
  })
}
