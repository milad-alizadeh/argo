import { DatabaseSync } from 'node:sqlite'
import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import { sessionIngestionSchema } from '@/domains/sessions/contract/session-index'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { indexSessionIngestions } from '../storage/session-upsert'

const workerInputSchema = z.strictObject({
  cancelFlag: z.instanceof(SharedArrayBuffer),
  databasePath: z.string().min(1),
  sessions: z.array(sessionIngestionSchema),
})

const workerPort = parentPort
if (workerPort === null) throw new Error('Session index worker has no parent port.')

workerPort.once('message', (value: unknown) => {
  const input = workerInputSchema.parse(value)
  if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
    throw new Error('Session index worker was cancelled.')
  const client = new DatabaseSync(input.databasePath)
  try {
    client.exec('PRAGMA journal_mode = WAL')
    client.exec('PRAGMA busy_timeout = 5000')
    // The source generation can replace this job while the worker starts.
    if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
      throw new Error('Session index worker was cancelled.')
    workerPort.postMessage(indexSessionIngestions(createDurableDatabase(client), input.sessions))
  } finally {
    client.close()
  }
})
