import { parentPort } from 'node:worker_threads'
import { getSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  sessionIndexWorkerInputSchema,
  writeSessionIndex,
} from '@/domains/sessions/main/sync/session-index-worker'
import {
  type ClaudeDiscoveryResult,
  parseClaudeSessions,
  readClaudeSessions,
} from './claude-discovery'

const inputSchema = sessionIndexWorkerInputSchema.extend({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  priorityNativeId: z.string().min(1).nullable(),
})

const workerPort = parentPort
if (workerPort === null) throw new Error('Claude Session sync worker has no parent port.')

workerPort.once('message', async (value: unknown) => {
  const input = inputSchema.parse(value)
  if (Atomics.load(new Int32Array(input.cancelFlag), 0) !== 0)
    throw new Error('Session index worker was cancelled.')
  let discovery: ClaudeDiscoveryResult
  if (input.priorityNativeId === null) {
    discovery = await readClaudeSessions({ limit: input.limit, offset: input.offset })
  } else {
    const session = await getSessionInfo(input.priorityNativeId)
    discovery = parseClaudeSessions(session === undefined ? [] : [session])
    if (discovery.sessions.some((row) => row.nativeId !== input.priorityNativeId))
      throw new Error('Priority Session lookup returned a different Session.')
  }
  const indexedCount = writeSessionIndex({
    cancelFlag: input.cancelFlag,
    databasePath: input.databasePath,
    sessions: discovery.sessions,
  })
  const cursor =
    input.priorityNativeId !== null || discovery.recordCount < input.limit
      ? null
      : String(input.offset + input.limit)
  workerPort.postMessage({ cursor, indexedCount, invalidRecordCount: discovery.invalidRecordCount })
})
