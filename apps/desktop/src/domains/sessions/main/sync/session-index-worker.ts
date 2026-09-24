import { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { indexSessionIngestions } from '../storage/session-upsert'

export const sessionIndexWorkerInputSchema = z.strictObject({
  cancelFlag: z.instanceof(SharedArrayBuffer),
  databasePath: z.string().min(1),
})

export function writeSessionIndex(input: {
  cancelFlag: SharedArrayBuffer
  databasePath: string
  sessions: SessionIngestion[]
}) {
  const isCancelled = () => Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0
  if (isCancelled()) throw new Error('Session index worker was cancelled.')
  const client = new DatabaseSync(input.databasePath)
  try {
    client.exec('PRAGMA journal_mode = WAL')
    client.exec('PRAGMA busy_timeout = 5000')
    indexSessionIngestions(createDurableDatabase(client), input.sessions, isCancelled)
    return input.sessions.length
  } finally {
    client.close()
  }
}
