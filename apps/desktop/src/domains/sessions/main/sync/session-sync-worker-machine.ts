import { sendTo, setup } from 'xstate'
import type { SessionSyncStatusStore } from './session-sync-status'
import { sessionSyncWorkerActor } from './session-sync-worker-actor'

export const sessionSyncWorkerMachine = setup({
  types: {
    context: {} as {
      databasePath: string | null
      status: SessionSyncStatusStore
    },
    input: {} as {
      databasePath: string | null
      status: SessionSyncStatusStore
    },
    events: {} as {
      type: 'Refresh'
    },
  },
  actors: {
    worker: sessionSyncWorkerActor,
  },
  actions: {
    forwardRefresh: sendTo('worker', ({ event }) => event),
  },
}).createMachine({
  id: 'sessionSyncWorker',
  context: ({ input }) => input,
  invoke: {
    id: 'worker',
    src: 'worker',
    input: ({ context }) => context,
  },
  on: {
    Refresh: {
      actions: 'forwardRefresh',
    },
  },
})
