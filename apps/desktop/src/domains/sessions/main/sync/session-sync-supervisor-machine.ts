import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { assertEvent, assign, enqueueActions, fromCallback, sendTo, setup, stopChild } from 'xstate'
import { z } from 'zod'
import type { Harness } from '@/harnesses/harness'
import {
  type SessionSyncStatus,
  type SessionSyncStatusStore,
  sessionSyncEventSchema,
} from '../api/session-sync-status'

const workerMessageSchema = z.union([
  sessionSyncEventSchema,
  z.strictObject({
    type: z.literal('finished'),
    outcome: z.enum([
      'ready',
      'failed',
    ]),
  }),
])

export type SessionSyncWorkerActorInput = {
  harness: Harness
  databasePath: string | null
}

type WorkerEvent =
  | {
      type: 'WorkerReady'
      harness: Harness
    }
  | {
      type: 'WorkerStatus'
      harness: Harness
      status: SessionSyncStatus
    }
  | {
      type: 'WorkerCommitted'
      harness: Harness
    }
  | {
      type: 'WorkerCompleted'
      harness: Harness
    }
  | {
      type: 'WorkerFailed'
      harness: Harness
    }

const sessionSyncWorkerActor = fromCallback<
  {
    type: 'Stop'
  },
  SessionSyncWorkerActorInput,
  WorkerEvent
>(({ input, sendBack }) => {
  if (input.databasePath === null) {
    sendBack({
      type: 'WorkerStatus',
      harness: input.harness,
      status: {
        phase: 'failed',
        processed: 0,
        total: null,
        skipped: 0,
        lastSuccessfulSyncAt: null,
        failure: 'Session sync database path is unavailable.',
      },
    })
    sendBack({
      type: 'WorkerFailed',
      harness: input.harness,
    })
    return () => {}
  }

  const worker = new Worker(path.join(__dirname, 'session-sync-worker.js'), {
    workerData: {
      databasePath: input.databasePath,
      harness: input.harness,
    },
  })
  worker.unref()
  let stopping = false
  let exited = false
  let outcome: 'ready' | 'failed' | null = null
  let workerError: string | null = null
  let forcedStop: ReturnType<typeof setTimeout> | undefined

  worker.on('online', () =>
    sendBack({
      type: 'WorkerReady',
      harness: input.harness,
    }),
  )

  worker.on('message', (message: unknown) => {
    if (stopping) return
    const parsed = workerMessageSchema.safeParse(message)
    if (!parsed.success) {
      console.error('Invalid Session sync worker message.', parsed.error)
      workerError = 'Invalid Session sync worker message.'
      void worker.terminate()
      return
    }
    switch (parsed.data.type) {
      case 'status':
        sendBack({
          type: 'WorkerStatus',
          harness: input.harness,
          status: parsed.data.status,
        })
        break
      case 'committed':
        sendBack({
          type: 'WorkerCommitted',
          harness: input.harness,
        })
        break
      case 'finished':
        outcome = parsed.data.outcome
        break
    }
  })
  worker.on('error', (error) => {
    if (stopping) return
    workerError = String(error)
  })
  worker.on('exit', (code) => {
    exited = true
    if (forcedStop !== undefined) clearTimeout(forcedStop)
    if (stopping) return
    if (code === 0 && outcome === 'ready') {
      sendBack({
        type: 'WorkerCompleted',
        harness: input.harness,
      })
      return
    }
    if (outcome !== 'failed')
      sendBack({
        type: 'WorkerStatus',
        harness: input.harness,
        status: {
          phase: 'failed',
          processed: 0,
          total: null,
          skipped: 0,
          lastSuccessfulSyncAt: null,
          failure: workerError ?? `Session sync worker exited with code ${code}.`,
        },
      })
    sendBack({
      type: 'WorkerFailed',
      harness: input.harness,
    })
  })

  return () => {
    stopping = true
    if (exited) return
    forcedStop = setTimeout(() => void worker.terminate(), 5000)
    forcedStop.unref()
    try {
      worker.postMessage('Shutdown')
    } catch {
      void worker.terminate()
    }
  }
})

const sessionSyncStatusActor = fromCallback<
  | {
      type: 'Update'
      status: SessionSyncStatus
    }
  | {
      type: 'Committed'
    },
  SessionSyncStatusStore
>(({ input, receive }) => {
  receive((event) => {
    switch (event.type) {
      case 'Update':
        input.update(event.status)
        break
      case 'Committed':
        input.committed()
        break
    }
  })
})

const supportedHarnesses = [
  'claude',
] as const satisfies readonly Harness[]

type SupervisorInput = {
  databasePath: string | null
  status: SessionSyncStatusStore
}

type SupervisorEvent =
  | {
      type: 'xstate.init'
      input: SupervisorInput
    }
  | {
      type: 'Refresh'
    }
  | {
      type: 'Shutdown'
    }
  | WorkerEvent

export const sessionSyncSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      databasePath: string | null
      jobs: Partial<Record<Harness, 'starting' | 'running'>>
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    worker: sessionSyncWorkerActor,
    status: sessionSyncStatusActor,
  },
  actions: {
    dispatchSupportedJobs: enqueueActions(({ context, enqueue }) => {
      if (context.databasePath === null) return
      for (const harness of supportedHarnesses) {
        if (context.jobs[harness] !== undefined) continue
        enqueue.spawnChild('worker', {
          id: `session-sync-${harness}`,
          input: {
            harness,
            databasePath: context.databasePath,
          },
        })
        enqueue.assign({
          jobs: ({ context: current }) => ({
            ...current.jobs,
            [harness]: 'starting',
          }),
        })
      }
    }),
    releaseJob: enqueueActions(({ event, enqueue }) => {
      if (event.type !== 'WorkerCompleted' && event.type !== 'WorkerFailed') return
      enqueue(stopChild(`session-sync-${event.harness}`))
      enqueue.assign({
        jobs: ({ context }) => {
          const { [event.harness]: _finished, ...remaining } = context.jobs
          return remaining
        },
      })
    }),
    rememberReady: assign({
      jobs: ({ context, event }) => {
        if (event.type !== 'WorkerReady' || context.jobs[event.harness] === undefined)
          return context.jobs
        return {
          ...context.jobs,
          [event.harness]: 'running',
        }
      },
    }),
    reportStatus: sendTo('status', ({ event }) => {
      assertEvent(event, 'WorkerStatus')
      return {
        type: 'Update',
        status: event.status,
      }
    }),
    reportCommit: sendTo('status', {
      type: 'Committed',
    }),
  },
}).createMachine({
  id: 'sessionSyncSupervisor',
  initial: 'Running',
  context: ({ input }) => ({
    databasePath: input.databasePath,
    jobs: {},
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
      entry: 'dispatchSupportedJobs',
      on: {
        Refresh: {
          actions: 'dispatchSupportedJobs',
        },
        WorkerReady: {
          actions: 'rememberReady',
        },
        WorkerStatus: {
          actions: 'reportStatus',
        },
        WorkerCommitted: {
          actions: 'reportCommit',
        },
        WorkerCompleted: {
          actions: 'releaseJob',
        },
        WorkerFailed: {
          actions: 'releaseJob',
        },
        Shutdown: 'Closed',
      },
    },
    Closed: {
      type: 'final',
    },
  },
})
