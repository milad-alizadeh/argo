import {
  type ActorRefFrom,
  assertEvent,
  assign,
  createActor,
  enqueueActions,
  fromCallback,
  fromPromise,
  type SnapshotFrom,
  setup,
  stopChild,
} from 'xstate'
import type { Database } from '@/database/database'
import type {
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import { type Harness, harnessSessionKey } from '@/harnesses/harness'
import type { SessionListChanges } from '../api'
import {
  type SessionSyncStatus,
  IDLE_SESSION_SYNC_STATUS,
  sessionSyncStatusSchema,
} from '../session-sync-status'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

type RegisteredHarnesses = Partial<
  Record<
    Harness,
    {
      listSessionSummaries: SessionSummaryList
      getSessionSummary: SessionSummaryReader
    }
  >
>

export type SessionSyncActorInput = {
  database: Database
  changes: SessionListChanges
  harness: Harness
  listSessionSummaries: SessionSummaryList
}

type SessionDiscoverActorInput = {
  database: Database
  changes: SessionListChanges
  harness: Harness
  nativeId: string
  getSessionSummary: SessionSummaryReader
}

// Waits between a new Session's lookups, for a Harness that lists a Session late.
const DISCOVERY_RETRY_DELAYS_MS = [
  500,
  1_500,
  4_500,
  13_500,
]

type SyncActorEvent =
  | {
      type: 'SyncStatus'
      harness: Harness
      status: SessionSyncStatus
    }
  | {
      type: 'SyncCompleted'
      harness: Harness
    }
  | {
      type: 'SyncFailed'
      harness: Harness
    }

// Saves Harness summaries under their matched Projects, and announces the Sessions they touched.
function saveSummaries(
  { database, changes, harness }: Pick<SessionSyncActorInput, 'database' | 'changes' | 'harness'>,
  summaries: readonly SessionSummary[],
): void {
  changes.changed(saveSessionBatch(database, harness, matchSessionsToProjects(database, summaries)))
}

type DiscoverFinished = {
  type: 'DiscoverFinished'
  harness: Harness
  nativeId: string
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
    failure: snapshot.context.failure,
  })
}

const sessionSyncActor = fromCallback<
  {
    type: 'Stop'
  },
  SessionSyncActorInput,
  SyncActorEvent
>(({ input, sendBack }) => {
  const { database, harness, listSessionSummaries } = input
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        save: fromPromise(async ({ input: saveInput }) => {
          saveSummaries(input, saveInput.records)
        }),
      },
    }),
    {
      input: {
        harness,
        knownNativeIds: knownSessionIds(database, harness),
        listSessionSummaries,
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

// One Session the external Session poll saw before any sync stored it. It gets that Session's
// summary, and asks again with a growing wait while the Harness does not know it yet.
const sessionDiscoverActor = fromCallback<
  {
    type: 'Stop'
  },
  SessionDiscoverActorInput,
  DiscoverFinished
>(({ input, sendBack }) => {
  const { harness, nativeId, getSessionSummary } = input
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const attempt = async (retry: number): Promise<void> => {
    let stored = false
    try {
      const summary = await getSessionSummary(nativeId)
      if (stopped) return
      if (summary !== null) {
        saveSummaries(input, [
          summary,
        ])
        stored = true
      }
    } catch (error) {
      if (stopped) return
      console.warn(`${harness} could not store the Session summary for ${nativeId}.`, error)
    }
    const delay = DISCOVERY_RETRY_DELAYS_MS[retry]
    if (stored || delay === undefined)
      return sendBack({
        type: 'DiscoverFinished',
        harness,
        nativeId,
      })
    timer = setTimeout(() => void attempt(retry + 1), delay)
  }
  void attempt(0)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
})

type SupervisorInput = {
  database: Database
  changes: SessionListChanges
  harnesses: RegisteredHarnesses
}

type SupervisorEvent =
  | SessionSyncSupervisorCommand
  | DiscoverFinished
  | {
      type: 'Shutdown'
    }
  | {
      type: 'ReplayRefresh'
      harness: Harness
    }
  | SyncActorEvent

type SessionSyncSupervisorCommand =
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
      changes: SessionListChanges
      active: Partial<Record<Harness, true>>
      // A Refresh that found a Harness still syncing, run again once it finishes.
      pending: Partial<Record<Harness, true>>
      // New-Session lookups in flight, by `<harness>:<nativeId>`.
      discovering: Record<string, true>
      harnesses: RegisteredHarnesses
      // Each Harness's scan progress, held in memory only.
      status: Partial<Record<Harness, SessionSyncStatus>>
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    sync: sessionSyncActor,
    discover: sessionDiscoverActor,
  },
  actions: {
    dispatchSyncs: enqueueActions(({ context, event, enqueue }) => {
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
            changes: context.changes,
            harness,
            listSessionSummaries: registration.listSessionSummaries,
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
      const key = harnessSessionKey(event)
      if (registration === undefined || context.discovering[key] === true) return
      enqueue.spawnChild('discover', {
        id: `session-discover-${key}`,
        input: {
          database: context.database,
          changes: context.changes,
          harness: event.harness,
          nativeId: event.nativeId,
          getSessionSummary: registration.getSessionSummary,
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
      const key = harnessSessionKey(event)
      enqueue(stopChild(`session-discover-${key}`))
      enqueue.assign({
        discovering: ({ context: current }) => {
          const { [key]: _finished, ...remaining } = current.discovering
          return remaining
        },
      })
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
    recordStatus: assign({
      status: ({ context, event }) => {
        assertEvent(event, 'SyncStatus')
        return { ...context.status, [event.harness]: event.status }
      },
    }),
  },
}).createMachine({
  id: 'sessionSyncSupervisor',
  initial: 'Running',
  context: ({ input }) => ({
    database: input.database,
    changes: input.changes,
    active: {},
    pending: {},
    discovering: {},
    harnesses: input.harnesses,
    status: Object.fromEntries(
      Object.keys(input.harnesses).map((harness) => [harness, IDLE_SESSION_SYNC_STATUS]),
    ),
  }),
  states: {
    Running: {
      on: {
        Refresh: {
          actions: 'dispatchSyncs',
        },
        Discover: {
          actions: 'discoverSession',
        },
        DiscoverFinished: {
          actions: 'releaseDiscovery',
        },
        ReplayRefresh: {
          actions: 'dispatchSyncs',
        },
        SyncStatus: {
          actions: 'recordStatus',
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

export type SessionSyncSupervisorActor = ActorRefFrom<typeof sessionSyncSupervisorMachine>
