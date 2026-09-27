import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { assertEvent, assign, enqueueActions, fromCallback, sendTo, setup, stopChild } from 'xstate'
import { z } from 'zod'
import { createCodexSessionSyncWorkerBridge } from '@/harnesses/codex/session/session-sync-codex-bridge'
import type { Harness } from '@/harnesses/harness'
import type { SessionDiscoveryJob } from '@/harnesses/session-sync-job'
import {
  type SessionSyncStatus,
  type SessionSyncStatusStore,
  sessionSyncEventSchema,
} from '../api/session-sync-status'
import type { SessionSyncWorkerBridge } from './session-sync-worker-bridge'

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
  job: SessionDiscoveryJob
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
>(({ input, sendBack, system }) => {
  const harness = input.job.harness
  if (input.databasePath === null) {
    sendBack({
      type: 'WorkerStatus',
      harness,
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
      harness,
    })
    return () => {}
  }

  let stopping = false
  let exited = false
  let worker: Worker | undefined
  let uninstallBridge: (() => void) | undefined
  let cancelReadiness = () => {}
  let outcome: 'ready' | 'failed' | null = null
  let workerError: string | null = null
  let forcedStop: ReturnType<typeof setTimeout> | undefined

  const launchWorker = (bridge?: SessionSyncWorkerBridge) => {
    if (stopping) return
    const child = new Worker(path.join(__dirname, 'session-sync-worker.js'), {
      workerData: {
        databasePath: input.databasePath,
        job: input.job,
      },
    })
    worker = child
    child.unref()
    if (bridge !== undefined) uninstallBridge = bridge.install(child)
    child.on('online', () =>
      sendBack({
        type: 'WorkerReady',
        harness,
      }),
    )

    child.on('message', (message: unknown) => {
      if (stopping) return
      if (bridge?.handlesWorkerMessage(message) === true) return
      const parsed = workerMessageSchema.safeParse(message)
      if (!parsed.success) {
        console.error('Invalid Session sync worker message.', parsed.error)
        workerError = 'Invalid Session sync worker message.'
        void child.terminate()
        return
      }
      switch (parsed.data.type) {
        case 'status':
          sendBack({
            type: 'WorkerStatus',
            harness,
            status: parsed.data.status,
          })
          break
        case 'committed':
          sendBack({
            type: 'WorkerCommitted',
            harness,
          })
          break
        case 'finished':
          outcome = parsed.data.outcome
          break
      }
    })
    child.on('error', (error) => {
      if (stopping) return
      workerError = String(error)
    })
    child.on('exit', (code) => {
      exited = true
      if (forcedStop !== undefined) clearTimeout(forcedStop)
      if (stopping) return
      if (code === 0 && outcome === 'ready') {
        sendBack({
          type: 'WorkerCompleted',
          harness,
        })
        return
      }
      if (outcome !== 'failed')
        sendBack({
          type: 'WorkerStatus',
          harness,
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
        harness,
      })
    })
  }

  switch (input.job.kind) {
    case 'claude-session-discovery':
      launchWorker()
      break
    case 'codex-session-discovery': {
      const codexActor = system.get('codex') as
        | Parameters<typeof createCodexSessionSyncWorkerBridge>[0]
        | undefined
      if (codexActor === undefined) {
        sendBack({
          type: 'WorkerStatus',
          harness,
          status: {
            phase: 'failed',
            processed: 0,
            total: null,
            skipped: 0,
            lastSuccessfulSyncAt: null,
            failure: 'Codex app-server actor is unavailable.',
          },
        })
        sendBack({
          type: 'WorkerFailed',
          harness,
        })
      } else {
        const bridge = createCodexSessionSyncWorkerBridge(codexActor)
        cancelReadiness = bridge.start({
          ready: () => launchWorker(bridge),
          fail: (error) => {
            sendBack({
              type: 'WorkerStatus',
              harness,
              status: {
                phase: 'failed',
                processed: 0,
                total: null,
                skipped: 0,
                lastSuccessfulSyncAt: null,
                failure: String(error),
              },
            })
            sendBack({
              type: 'WorkerFailed',
              harness,
            })
          },
        })
      }
      break
    }
    default: {
      const unknownJob: never = input.job
      throw new Error(`Unsupported Session discovery job: ${unknownJob}`)
    }
  }

  return () => {
    stopping = true
    cancelReadiness()
    uninstallBridge?.()
    if (worker === undefined || exited) return
    const child = worker
    forcedStop = setTimeout(() => void child.terminate(), 5000)
    forcedStop.unref()
    try {
      child.postMessage('Shutdown')
    } catch {
      void child.terminate()
    }
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
  databasePath: string | null
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
  | WorkerEvent

export type SessionSyncSupervisorCommand =
  | {
      type: 'Refresh'
    }
  | {
      type: 'RegisterJobs'
      jobs: SessionDiscoveryJob[]
    }

export const sessionSyncSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      databasePath: string | null
      jobs: Partial<Record<Harness, 'starting' | 'running'>>
      sessionDiscoveryJobs: SessionDiscoveryJob[]
      configured: boolean
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    worker: sessionSyncWorkerActor,
    status: sessionSyncStatusActor,
  },
  actions: {
    registerJobs: assign(({ context, event }) => {
      assertEvent(event, 'RegisterJobs')
      if (context.configured) return {}
      return {
        sessionDiscoveryJobs: event.jobs,
        configured: true,
      }
    }),
    dispatchSupportedJobs: enqueueActions(({ context, enqueue }) => {
      if (context.databasePath === null || !context.configured) return
      for (const job of context.sessionDiscoveryJobs) {
        const { harness } = job
        if (context.jobs[harness] !== undefined) continue
        enqueue.spawnChild('worker', {
          id: `session-sync-${harness}`,
          input: {
            job,
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
        harness: event.harness,
        status: event.status,
      }
    }),
    reportCommit: sendTo('status', ({ event }) => {
      assertEvent(event, 'WorkerCommitted')
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
    databasePath: input.databasePath,
    jobs: {},
    sessionDiscoveryJobs: [],
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
        RegisterJobs: {
          actions: 'registerJobs',
        },
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
