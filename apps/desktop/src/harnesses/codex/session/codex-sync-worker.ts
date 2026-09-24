import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import {
  sessionIndexWorkerInputSchema,
  writeSessionIndex,
} from '@/domains/sessions/main/sync/session-index-worker'
import { codexThreadPageSchema, parseCodexSessionPage } from './codex-discovery'

const inputSchema = sessionIndexWorkerInputSchema.extend({
  page: codexThreadPageSchema,
  priorityNativeId: z.string().min(1).nullable(),
})

const workerPort = parentPort
if (workerPort === null) throw new Error('Codex Session sync worker has no parent port.')

workerPort.once('message', (value: unknown) => {
  const input = inputSchema.parse(value)
  const discovery = parseCodexSessionPage(input.page)
  if (
    input.priorityNativeId !== null &&
    discovery.sessions.some((row) => row.nativeId !== input.priorityNativeId)
  )
    throw new Error('Priority Session lookup returned a different Session.')
  const indexedCount = writeSessionIndex({
    cancelFlag: input.cancelFlag,
    databasePath: input.databasePath,
    sessions: discovery.sessions,
  })
  workerPort.postMessage({
    cursor: discovery.nextCursor,
    indexedCount,
    invalidRecordCount: discovery.invalidRecordCount,
  })
})
