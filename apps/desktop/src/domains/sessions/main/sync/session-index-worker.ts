import { DatabaseSync } from 'node:sqlite'
import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import { sessionIngestionSchema } from '@/domains/sessions/contract/session-index'
import { readClaudeSessions } from '@/harnesses/claude/session/claude-discovery'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { indexSessionIngestions } from '../storage/session-upsert'

const workerInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    cancelFlag: z.instanceof(SharedArrayBuffer),
    databasePath: z.string().min(1),
    kind: z.literal('index'),
    sessions: z.array(sessionIngestionSchema),
  }),
  z.strictObject({
    cancelFlag: z.instanceof(SharedArrayBuffer),
    databasePath: z.string().min(1),
    kind: z.literal('claude-discovery'),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
])

const workerPort = parentPort
if (workerPort === null) throw new Error('Session index worker has no parent port.')

workerPort.once('message', async (value: unknown) => {
  const input = workerInputSchema.parse(value)
  if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
    throw new Error('Session index worker was cancelled.')
  const discovery =
    input.kind === 'claude-discovery'
      ? await readClaudeSessions({ limit: input.limit, offset: input.offset })
      : null
  if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
    throw new Error('Session index worker was cancelled.')
  const sessions = input.kind === 'index' ? input.sessions : (discovery?.sessions ?? [])
  const client = new DatabaseSync(input.databasePath)
  try {
    client.exec('PRAGMA journal_mode = WAL')
    client.exec('PRAGMA busy_timeout = 5000')
    // The source generation can replace this job while the worker starts.
    if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
      throw new Error('Session index worker was cancelled.')
    const indexed = indexSessionIngestions(createDurableDatabase(client), sessions)
    workerPort.postMessage(
      input.kind === 'index'
        ? indexed
        : {
            ...indexed,
            complete: discovery?.recordCount !== input.limit,
            invalidRecordCount: discovery?.invalidRecordCount ?? 0,
          },
    )
  } finally {
    client.close()
  }
})
