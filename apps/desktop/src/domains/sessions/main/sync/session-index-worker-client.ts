import { Worker } from 'node:worker_threads'
import { z } from 'zod'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { SessionIndexResult } from '../storage/session-upsert'

const sessionIndexResultSchema = z.strictObject({
  argoIds: z.array(z.string().uuid()),
  indexedCount: z.number().int().nonnegative(),
})

export function indexSessionsInWorker(input: {
  databasePath: string
  sessions: SessionIngestion[]
  signal: AbortSignal
}): Promise<SessionIndexResult> {
  return new Promise((resolve, reject) => {
    const cancelFlag = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
    const worker = new Worker(new URL('./session-index-worker.ts', import.meta.url), {
      name: 'session-index',
    })
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      input.signal.removeEventListener('abort', cancel)
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
    worker.once('message', (value: unknown) =>
      finish(() => resolve(sessionIndexResultSchema.parse(value))),
    )
    input.signal.addEventListener('abort', cancel, { once: true })
    if (input.signal.aborted) {
      cancel()
      return
    }
    worker.postMessage({ cancelFlag, databasePath: input.databasePath, sessions: input.sessions })
  })
}
