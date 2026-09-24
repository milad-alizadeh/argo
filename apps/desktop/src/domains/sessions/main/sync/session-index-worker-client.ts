import type { Worker } from 'node:worker_threads'
import type { z } from 'zod'
import { sessionSyncResultSchema } from './session-sync-machine'

const workerResultSchema = sessionSyncResultSchema.omit({ generation: true })

export function runSessionIndexWorker(worker: Worker, input: object, signal: AbortSignal) {
  return new Promise<z.infer<typeof workerResultSchema>>((resolve, reject) => {
    const cancelFlag = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)
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
    worker.once('exit', (code) =>
      finish(() => reject(new Error(`Session index worker stopped with ${code}.`))),
    )
    worker.once('message', (value: unknown) => {
      const result = workerResultSchema.safeParse(value)
      finish(() =>
        result.success
          ? resolve(result.data)
          : reject(new Error('Session index worker returned an invalid result.')),
      )
    })
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) {
      cancel()
      return
    }
    worker.postMessage({ ...input, cancelFlag })
  })
}
