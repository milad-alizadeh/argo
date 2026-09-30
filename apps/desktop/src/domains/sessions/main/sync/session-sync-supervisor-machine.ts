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
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
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

export type SessionDiscoverActorInput = SessionSyncActorInput & {
  nativeId: string
}

// Waits between a targeted discovery's attempts, for a Harness that lists a Session late.
const DISCOVERY_RETRY_DELAYS_MS = [
  500,
  1_500,
  4_500,
  13_500,
]

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

type DiscoverFinished = {
  type: 'DiscoverFinished'
  harness: Harness
  nativeId: string
  listed: boolean
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

// One Session the history watcher saw before any sync listed it. It reads that Session alone, and
// asks again with a growing wait while the Harness does not list it yet.
const sessionDiscoverActor = fromCallback<
  {
    type: 'Stop'
  },
  SessionDiscoverActorInput,
  | Extract<
      SessionSyncEvent,
      {
        type: 'SyncCommitted'
      }
    >
  | DiscoverFinished
>(({ input, sendBack }) => {
  const { database, harness, nativeId, sessionDiscovery } = input
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = (listed: boolean) => {
    if (!stopped)
      sendBack({
        type: 'DiscoverFinished',
        harness,
        nativeId,
        listed,
      })
  }
  const attempt = async (retry: number): Promise<void> => {
    let found = false
    try {
      const { records } = await sessionDiscovery({
        knownNativeIds: [],
        nativeId,
      })
      if (stopped) return
      if (records.length > 0) {
        saveSessionBatch(database, harness, matchSessionsToProjects(database, records))
        sendBack({
          type: 'SyncCommitted',
          harness,
        })
        found = true
      }
    } catch (error) {
      console.warn(`${harness} Session discovery could not read ${nativeId}.`, error)
    }
    if (found) return finish(true)
    const delay = DISCOVERY_RETRY_DELAYS_MS[retry]
    if (delay === undefined) return finish(false)
    timer = setTimeout(() => void attempt(retry + 1), delay)
  }
  void attempt(0)
  return () => {
    stopped = true
    clearTimeout(timer)
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
  harnesses: RegisteredHarnesses
  status: Partial<Record<Harness, SessionSyncStatusStore>>
}

type SupervisorEvent =
  | {
      type: 'xstate.init'
      input: SupervisorInput
    }
  | SessionSyncSupervisorCommand
  | DiscoverFinished
  | {
      type: 'Shutdown'
    }
  | {
      type: 'ReplayRefresh'
      harness: Harness
    }
  | SessionSyncEvent

export type SessionSyncSupervisorCommand =
  | {
      type: 'Refresh'
    }
  | {
      type: 'Discover'
      harness: Harness
      nativeId: string
    }

export const sessionSyncSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      database: Database
      active: Partial<Record<Harness, true>>
      // A Refresh that found a Harness still syncing, run again once it finishes.
      pending: Partial<Record<Harness, true>>
      // Targeted discoveries in flight, and the ones that gave up, as `<harness>:<nativeId>`.
      discovering: Record<string, true>
      unlisted: Record<string, true>
      harnesses: RegisteredHarnesses
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    sync: sessionSyncActor,
    discover: sessionDiscoverActor,
    status: sessionSyncStatusActor,
  },
  actions: {
    dispatchSessionDiscoveries: enqueueActions(({ context, event, enqueue }) => {
      const harnesses =
        event.type === 'ReplayRefresh'
          ? [
              event.harness,
            ]
          : (Object.keys(context.harnesses) as Harness[])
      for (const harness of harnesses) {
        const registration = context.harnesses[harness]
        if (registration === undefined) continue
        if (context.active[harness] === true) {
          enqueue.assign({
            pending: ({ context: current }) => ({
              ...current.pending,
              [harness]: true,
            }),
          })
          continue
        }
        enqueue.spawnChild('sync', {
          id: `session-sync-${harness}`,
          input: {
            database: context.database,
            harness,
            sessionDiscovery: registration.sessionDiscovery,
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
    discoverSession: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'Discover')
      const registration = context.harnesses[event.harness]
      const key = `${event.harness}:${event.nativeId}`
      if (
        registration === undefined ||
        context.discovering[key] === true ||
        context.unlisted[key] === true
      )
        return
      enqueue.spawnChild('discover', {
        id: `session-discover-${key}`,
        input: {
          database: context.database,
          harness: event.harness,
          nativeId: event.nativeId,
          sessionDiscovery: registration.sessionDiscovery,
        },
      })
      enqueue.assign({
        discovering: ({ context: current }) => ({
          ...current.discovering,
          [key]: true,
        }),
      })
    }),
    releaseDiscovery: enqueueActions(({ event, enqueue }) => {
      assertEvent(event, 'DiscoverFinished')
      const key = `${event.harness}:${event.nativeId}`
      enqueue(stopChild(`session-discover-${key}`))
      enqueue.assign({
        discovering: ({ context: current }) => {
          const { [key]: _finished, ...remaining } = current.discovering
          return remaining
        },
        unlisted: ({ context: current }) =>
          event.listed
            ? current.unlisted
            : {
                ...current.unlisted,
                [key]: true,
              },
      })
    }),
    forgetUnlisted: assign({
      unlisted: {},
    }),
    releaseSync: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'SyncCompleted' && event.type !== 'SyncFailed') return
      enqueue(stopChild(`session-sync-${event.harness}`))
      enqueue.assign({
        active: ({ context: current }) => {
          const { [event.harness]: _finished, ...remaining } = current.active
          return remaining
        },
        pending: ({ context: current }) => {
          const { [event.harness]: _replayed, ...remaining } = current.pending
          return remaining
        },
      })
      if (context.pending[event.harness] === true)
        enqueue.raise({
          type: 'ReplayRefresh',
          harness: event.harness,
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
    pending: {},
    discovering: {},
    unlisted: {},
    harnesses: input.harnesses,
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
        Refresh: {
          actions: [
            'forgetUnlisted',
            'dispatchSessionDiscoveries',
          ],
        },
        Discover: {
          actions: 'discoverSession',
        },
        DiscoverFinished: {
          actions: 'releaseDiscovery',
        },
        ReplayRefresh: {
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
