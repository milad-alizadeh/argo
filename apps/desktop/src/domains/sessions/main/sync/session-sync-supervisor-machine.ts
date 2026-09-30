import {
  assertEvent,
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
import type { SessionHistoryReader } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import { refreshSessionSubagents } from '../database'
import {
  type SessionSyncStatus,
  type SessionSyncStatusStore,
  sessionSyncStatusSchema,
} from '../session-sync-status'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

type RegisteredHarnesses = Partial<
  Record<
    Harness,
    {
      sessionDiscovery: SessionDiscovery
      readHistory: SessionHistoryReader
    }
  >
>

export type SessionSyncActorInput = {
  database: Database
  harness: Harness
  sessionDiscovery: SessionDiscovery
  readHistory: SessionHistoryReader
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
      type: 'SyncStored'
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
  const { database, harness, sessionDiscovery, readHistory } = input
  let stopped = false
  // Subagents come from full history reads, so they run after the listing has committed.
  const completeWithSubagents = async () => {
    try {
      const { failed } = await refreshSessionSubagents({
        database,
        harness,
        readHistory,
        stored: () =>
          sendBack({
            type: 'SyncStored',
            harness,
          }),
        stopped: () => stopped,
      })
      if (failed > 0) console.warn(`${harness} Session sync could not read ${failed} histories.`)
    } catch (error) {
      console.warn(`${harness} Session sync could not store Subagents.`, error)
    }
    if (!stopped)
      sendBack({
        type: 'SyncCompleted',
        harness,
      })
  }
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
      void completeWithSubagents()
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
    stopped = true
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
    }
  | {
      type: 'Stored'
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
      case 'Stored':
        input[event.harness]?.stored()
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
  | {
      type: 'Shutdown'
    }
  | {
      type: 'ReplayRefresh'
      harness: Harness
    }
  | SessionSyncEvent

export type SessionSyncSupervisorCommand = {
  type: 'Refresh'
}

export const sessionSyncSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      database: Database
      active: Partial<Record<Harness, true>>
      // A Refresh that found a Harness still syncing, run again once it finishes.
      pending: Partial<Record<Harness, true>>
      harnesses: RegisteredHarnesses
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    sync: sessionSyncActor,
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
            readHistory: registration.readHistory,
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
    reportStored: sendTo('status', ({ event }) => {
      assertEvent(event, 'SyncStored')
      return {
        type: 'Stored',
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
          actions: 'dispatchSessionDiscoveries',
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
        SyncStored: {
          actions: 'reportStored',
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
