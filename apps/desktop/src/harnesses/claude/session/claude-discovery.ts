import { listSessions } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  type SessionIngestion,
  sessionIngestionSchema,
} from '@/domains/sessions/contract/session-index'

const claudeSessionInfoSchema = z.object({
  sessionId: z.string().uuid(),
  summary: z.string(),
  firstPrompt: z.string().optional(),
  lastModified: z.number().int().nonnegative(),
  cwd: z.string().min(1).optional(),
})

export type ClaudeDiscoveryResult = {
  sessions: SessionIngestion[]
  recordCount: number
  invalidRecordCount: number
}

export function parseClaudeSessions(records: unknown[]): ClaudeDiscoveryResult {
  let invalidRecordCount = 0
  const sessions = records.flatMap((record) => {
    const parsed = claudeSessionInfoSchema.safeParse(record)
    if (!parsed.success) {
      invalidRecordCount += 1
      return []
    }
    const session = sessionIngestionSchema.safeParse({
      harness: 'claude',
      nativeId: parsed.data.sessionId,
      vendorTitle: parsed.data.summary || null,
      firstPrompt: parsed.data.firstPrompt ?? null,
      updatedAt: parsed.data.lastModified,
      workingDirectory: parsed.data.cwd ?? null,
    })
    if (!session.success) {
      invalidRecordCount += 1
      return []
    }
    return [session.data]
  })
  return { sessions, recordCount: records.length, invalidRecordCount }
}

export async function readClaudeSessions(input: {
  limit: number
  offset: number
}): Promise<ClaudeDiscoveryResult> {
  const records = await listSessions({
    includeProgrammatic: true,
    limit: input.limit,
    offset: input.offset,
  })
  return parseClaudeSessions(records)
}
