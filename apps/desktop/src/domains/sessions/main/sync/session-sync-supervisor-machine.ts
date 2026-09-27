import {
  assertEvent,
  assign,
  createActor,
  enqueueActions,
  fromCallback,
  fromPromise,
  type SnapshotFrom,
  sendTo,
  setup,
  stopChild,
} from 'xstate'
import type { Database } from '@/database/database'
import type { Harness } from '@/harnesses/harness'
import type { SessionDiscovery } from '@/harnesses/session-discovery'
import {
  type SessionSyncStatus,
  type SessionSyncStatusStore,
  sessionSyncStatusSchema,
} from '../api/session-sync-status'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

type RegisteredHarnesses = Partial<
  Record<
    Harness,
    {
      sessionDiscovery: SessionDiscovery
    }
  >
>

export type SessionSyncActorInput = {
  database: Database
  harness: Harness
  sessionDiscovery: SessionDiscovery
}

type SessionSyncEvent =
  | {
      type: 'SyncStatus'
      harness: Harness
      status: SessionSyncStatus
    }
  | {
      type: 'SyncCommitted'
      harness: Harness
    }
  | {
      type: 'SyncCompleted'
      harness: Harness
    }
  | {
      type: 'SyncFailed'
      harness: Harness
    }

function statusFor(snapshot: SnapshotFrom<typeof sessionSyncMachine>): SessionSyncStatus {
  const phaseByState = {
    Idle: 'idle',
    Fetching: 'fetching',
    Saving: 'saving',
    Ready: 'ready',
    Failed: 'failed',
    Closed: 'idle',
  } as const
  return sessionSyncStatusSchema.parse({
    phase: phaseByState[snapshot.value],
    processed: snapshot.context.processed,
    total:
      snapshot.matches('Idle') || snapshot.matches('Fetching')
        ? null
        : snapshot.context.records.length,
    skipped: snapshot.context.skipped,
    lastSuccessfulSyncAt: snapshot.context.lastSuccessfulSyncAt,
    failure: snapshot.context.failure,
  })
}

const sessionSyncActor = fromCallback<
  {
    type: 'Stop'
  },
  SessionSyncActorInput,
  SessionSyncEvent
>(({ input, sendBack }) => {
  const { database, harness, sessionDiscovery } = input
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        save: fromPromise(async ({ input: saveInput }) => {
          saveSessionBatch(database, harness, matchSessionsToProjects(database, saveInput.records))
          sendBack({
            type: 'SyncCommitted',
            harness,
          })
        }),
      },
    }),
    {
      input: {
        harness,
        knownNativeIds: knownSessionIds(database, harness),
        sessionDiscovery,
      },
    },
  )
  const subscription = actor.subscribe((snapshot) => {
    if (snapshot.matches('Closed')) return
    sendBack({
      type: 'SyncStatus',
      harness,
      status: statusFor(snapshot),
    })
    if (snapshot.matches('Ready')) {
      if (snapshot.context.skipped > 0)
        console.warn(
          `${harness} Session sync skipped ${snapshot.context.skipped} malformed records.`,
        )
      sendBack({
        type: 'SyncCompleted',
        harness,
      })
    }
    if (snapshot.matches('Failed'))
      sendBack({
        type: 'SyncFailed',
        harness,
      })
  })
  actor.start()
  actor.send({
    type: 'Start',
  })
  return () => {
    subscription.unsubscribe()
    actor.stop()
  }
})

const sessionSyncStatusActor = fromCallback<
  | {
      type: 'Update'
      harness: Harness
      status: SessionSyncStatus
    }
  | {
      type: 'Committed'
      harness: Harness
    },
  Partial<Record<Harness, SessionSyncStatusStore>>
>(({ input, receive }) => {
  receive((event) => {
    switch (event.type) {
      case 'Update':
        input[event.harness]?.update(event.status)
        break
      case 'Committed':
        input[event.harness]?.committed()
        break
    }
  })
})

type SupervisorInput = {
  database: Database
  status: Partial<Record<Harness, SessionSyncStatusStore>>
}

type SupervisorEvent =
  | {
      type: 'xstate.init'
      input: SupervisorInput
    }
  | SessionSyncSupervisorCommand
  | {
      type: 'Shutdown'
    }
  | SessionSyncEvent

export type SessionSyncSupervisorCommand =
  | {
      type: 'Refresh'
    }
  | {
      type: 'RegisterHarnesses'
      harnesses: RegisteredHarnesses
    }

export const sessionSyncSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      database: Database
      active: Partial<Record<Harness, true>>
      harnesses: RegisteredHarnesses
      configured: boolean
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    sync: sessionSyncActor,
    status: sessionSyncStatusActor,
  },
  actions: {
    registerHarnesses: assign(({ context, event }) => {
      assertEvent(event, 'RegisterHarnesses')
      if (context.configured) return {}
      return {
        harnesses: event.harnesses,
        configured: true,
      }
    }),
    dispatchSessionDiscoveries: enqueueActions(({ context, enqueue }) => {
      if (!context.configured) return
      for (const harnessId of Object.keys(context.harnesses)) {
        const harness = harnessId as Harness
        const sessionDiscovery = context.harnesses[harness]?.sessionDiscovery
        if (sessionDiscovery === undefined || context.active[harness] === true) continue
        enqueue.spawnChild('sync', {
          id: `session-sync-${harness}`,
          input: {
            database: context.database,
            harness,
            sessionDiscovery,
          },
        })
        enqueue.assign({
          active: ({ context: current }) => ({
            ...current.active,
            [harness]: true,
          }),
        })
      }
    }),
    releaseSync: enqueueActions(({ event, enqueue }) => {
      if (event.type !== 'SyncCompleted' && event.type !== 'SyncFailed') return
      enqueue(stopChild(`session-sync-${event.harness}`))
      enqueue.assign({
        active: ({ context }) => {
          const { [event.harness]: _finished, ...remaining } = context.active
          return remaining
        },
      })
    }),
    reportStatus: sendTo('status', ({ event }) => {
      assertEvent(event, 'SyncStatus')
      return {
        type: 'Update',
        harness: event.harness,
        status: event.status,
      }
    }),
    reportCommit: sendTo('status', ({ event }) => {
      assertEvent(event, 'SyncCommitted')
      return {
        type: 'Committed',
        harness: event.harness,
      }
    }),
  },
}).createMachine({
  id: 'sessionSyncSupervisor',
  initial: 'Running',
  context: ({ input }) => ({
    database: input.database,
    active: {},
    harnesses: {},
    configured: false,
  }),
  invoke: {
    id: 'status',
    src: 'status',
    input: ({ event }) => {
      assertEvent(event, 'xstate.init')
      return event.input.status
    },
  },
  states: {
    Running: {
      on: {
        RegisterHarnesses: {
          actions: 'registerHarnesses',
        },
        Refresh: {
          actions: 'dispatchSessionDiscoveries',
        },
        SyncStatus: {
          actions: 'reportStatus',
        },
        SyncCommitted: {
          actions: 'reportCommit',
        },
        SyncCompleted: {
          actions: 'releaseSync',
        },
        SyncFailed: {
          actions: 'releaseSync',
        },
        Shutdown: 'Closed',
      },
    },
    Closed: {
      type: 'final',
    },
  },
})
