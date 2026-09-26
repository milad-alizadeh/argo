import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { type ActorRefFrom, assertEvent, fromCallback, setup } from 'xstate'
import type { Database } from '@/database/database'
import { liveSessionSupervisorMachine } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import {
  type SessionSyncStatusStore,
  sessionSyncStatusSchema,
} from '@/domains/sessions/main/sync/session-sync-status'
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
    sessionSync: fromCallback<
      {
        type: 'Refresh'
      },
      {
        databasePath: string | null
        status: SessionSyncStatusStore
      }
    >(({ input, receive }) => {
      if (input.databasePath === null) return () => {}
      const worker = new Worker(path.join(__dirname, 'session-sync-worker.js'), {
        workerData: {
          databasePath: input.databasePath,
        },
      })
      worker.on('message', (message: unknown) => {
        if (typeof message === 'object' && message !== null && 'type' in message) {
          if (
            (
              message as {
                type?: unknown
              }
            ).type === 'committed'
          ) {
            input.status.update(input.status.current())
            return
          }
        }
        const parsed = sessionSyncStatusSchema.safeParse(
          typeof message === 'object' && message !== null && 'status' in message
            ? (
                message as {
                  status: unknown
                }
              ).status
            : undefined,
        )
        if (parsed.success) input.status.update(parsed.data)
      })
      worker.on('error', (error) => {
        input.status.update({
          ...input.status.current(),
          phase: 'failed',
          failure: String(error),
        })
      })
      receive((event) => {
        if (event.type === 'Refresh') worker.postMessage('Refresh')
      })
      return () => {
        void worker.terminate()
      }
    }),
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
