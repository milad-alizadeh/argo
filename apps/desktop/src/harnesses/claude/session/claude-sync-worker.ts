import { getSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  serveSessionIndexWorker,
  sessionIndexWorkerInputSchema,
} from '@/domains/sessions/main/sync/session-index-worker'
import {
  type ClaudeDiscoveryResult,
  parseClaudeSessions,
  readClaudeSessions,
} from './claude-discovery'

const inputSchema = sessionIndexWorkerInputSchema.extend({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})

serveSessionIndexWorker(inputSchema, async (input) => {
  let discovery: ClaudeDiscoveryResult
  if (input.priorityNativeId === null) {
    discovery = await readClaudeSessions({ limit: input.limit, offset: input.offset })
  } else {
    const session = await getSessionInfo(input.priorityNativeId)
    discovery = parseClaudeSessions(session === undefined ? [] : [session])
  }
  return {
    sessions: discovery.sessions,
    cursor:
      input.priorityNativeId !== null || discovery.recordCount < input.limit
        ? null
        : String(input.offset + input.limit),
    invalidRecordCount: discovery.invalidRecordCount,
  }
})
