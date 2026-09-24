import { DatabaseSync } from 'node:sqlite'
import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { indexSessionIngestions } from '../storage/session-upsert'

export const sessionIndexWorkerInputSchema = z.strictObject({
  cancelFlag: z.instanceof(SharedArrayBuffer),
  databasePath: z.string().min(1),
  priorityNativeId: z.string().min(1).nullable(),
})

type SessionIndexPage = {
  sessions: SessionIngestion[]
  cursor: string | null
  invalidRecordCount: number
}

export function serveSessionIndexWorker<
  Schema extends z.ZodType<z.infer<typeof sessionIndexWorkerInputSchema>>,
>(
  schema: Schema,
  discover: (input: z.infer<Schema>) => SessionIndexPage | Promise<SessionIndexPage>,
) {
  if (parentPort === null) throw new Error('Session index worker has no parent port.')
  const workerPort = parentPort
  workerPort.once('message', async (value: unknown) => {
    const input = schema.parse(value)
    const isCancelled = () => Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0
    if (isCancelled()) throw new Error('Session index worker was cancelled.')
    const page = await discover(input)
    if (
      input.priorityNativeId !== null &&
      page.sessions.some((session) => session.nativeId !== input.priorityNativeId)
    )
      throw new Error('Priority Session lookup returned a different Session.')
    if (isCancelled()) throw new Error('Session index worker was cancelled.')
    const client = new DatabaseSync(input.databasePath)
    try {
      client.exec('PRAGMA journal_mode = WAL')
      client.exec('PRAGMA busy_timeout = 5000')
      indexSessionIngestions(createDurableDatabase(client), page.sessions, isCancelled)
      workerPort.postMessage({
        cursor: page.cursor,
        indexedCount: page.sessions.length,
        invalidRecordCount: page.invalidRecordCount,
      })
    } finally {
      client.close()
    }
  })
}
