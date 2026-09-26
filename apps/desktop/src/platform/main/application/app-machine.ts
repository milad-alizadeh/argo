import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { type ActorRefFrom, assertEvent, fromCallback, setup } from 'xstate'
import type { Database } from '@/database/database'
import {
  type SessionSyncStatusStore,
  sessionSyncEventSchema,
} from '@/domains/sessions/main/api/session-sync-status'
import { liveSessionSupervisorMachine } from '@/domains/sessions/main/live/live-session-supervisor-machine'
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

const sessionSyncWorkerActor = fromCallback<
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
  worker.unref()
  let stopping = false
  let forcedStop: ReturnType<typeof setTimeout> | undefined
  worker.on('message', (message: unknown) => {
    if (stopping) return
    const parsed = sessionSyncEventSchema.safeParse(message)
    if (!parsed.success) {
      console.error('Invalid Session sync worker message.', parsed.error)
      return
    }
    switch (parsed.data.type) {
      case 'status':
        input.status.update(parsed.data.status)
        break
      case 'committed':
        input.status.committed()
        break
    }
  })
  worker.on('error', (error) => {
    if (stopping) return
    input.status.update({
      ...input.status.current(),
      phase: 'failed',
      failure: String(error),
    })
  })
  worker.on('exit', (code) => {
    if (forcedStop !== undefined) clearTimeout(forcedStop)
    if (stopping) return
    input.status.update({
      ...input.status.current(),
      phase: 'failed',
      failure: `Session sync worker exited with code ${code}.`,
    })
  })
  receive((event) => {
    if (event.type === 'Refresh') worker.postMessage('Refresh')
  })
  return () => {
    stopping = true
    forcedStop = setTimeout(() => void worker.terminate(), 5000)
    forcedStop.unref()
    try {
      worker.postMessage('Shutdown')
    } catch {
      void worker.terminate()
    }
  }
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
            databasePath: string | null
            sessionSyncStatus: SessionSyncStatusStore
          }
        },
  },
  actors: {
    codex: codexMachine,
    catalog: catalogMachine,
    sessions: liveSessionSupervisorMachine,
    sessionSync: sessionSyncWorkerActor,
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
