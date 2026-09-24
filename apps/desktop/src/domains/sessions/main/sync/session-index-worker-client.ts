import { Worker } from 'node:worker_threads'
import { z } from 'zod'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { SessionIndexResult } from '../storage/session-upsert'

const sessionIndexResultSchema = z.strictObject({
  argoIds: z.array(z.string().uuid()),
  indexedCount: z.number().int().nonnegative(),
})
const claudeDiscoveryResultSchema = sessionIndexResultSchema.extend({
  complete: z.boolean(),
  invalidRecordCount: z.number().int().nonnegative(),
})

type WorkerInput =
  | {
      databasePath: string
      kind: 'claude-discovery'
      limit: number
      offset: number
    }
  | {
      databasePath: string
      kind: 'index'
      sessions: SessionIngestion[]
    }

function runSessionIndexWorker<Result>(
  input: WorkerInput,
  signal: AbortSignal,
  parse: (value: unknown) => Result,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const cancelFlag = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
    const worker = new Worker(new URL('./session-index-worker.ts', import.meta.url), {
      name: 'session-index',
    })
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', cancel)
      void worker.terminate()
      outcome()
    }
    const cancel = () => {
      Atomics.store(new Int32Array(cancelFlag), 0, 1)
      finish(() => reject(new Error('Session index worker was cancelled.')))
    }
    worker.once('error', (error) => finish(() => reject(error)))
    worker.once('exit', (code) => {
      if (code !== 0) finish(() => reject(new Error(`Session index worker stopped with ${code}.`)))
    })
    worker.once('message', (value: unknown) => finish(() => resolve(parse(value))))
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) {
      cancel()
      return
    }
    worker.postMessage({ ...input, cancelFlag })
  })
}

export function indexSessionsInWorker(input: {
  databasePath: string
  sessions: SessionIngestion[]
  signal: AbortSignal
}): Promise<SessionIndexResult> {
  return runSessionIndexWorker(
    { databasePath: input.databasePath, kind: 'index', sessions: input.sessions },
    input.signal,
    sessionIndexResultSchema.parse,
  )
}

export function discoverClaudeSessionsInWorker(input: {
  databasePath: string
  limit: number
  offset: number
  signal: AbortSignal
}) {
  return runSessionIndexWorker(
    {
      databasePath: input.databasePath,
      kind: 'claude-discovery',
      limit: input.limit,
      offset: input.offset,
    },
    input.signal,
    claudeDiscoveryResultSchema.parse,
  )
}
