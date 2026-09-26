import type { Worker } from 'node:worker_threads'

export type SessionSyncWorkerBridge = {
  handlesWorkerMessage: (message: unknown) => boolean
  install: (worker: Worker) => () => void
  start: (callbacks: { ready: () => void; fail: (error: unknown) => void }) => () => void
}
