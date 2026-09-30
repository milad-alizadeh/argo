import { getSessionInfo, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryListInput,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { SESSION_CLAUDE_SYNC_FIXTURE_ENV } from '../proof-protocol'

const claudeSessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    summary: z.string(),
    lastModified: z.number().int().nonnegative(),
    customTitle: z.string().nullable().optional(),
    firstPrompt: z.string().optional(),
    cwd: z.string().optional(),
  })
  .passthrough()

type ClaudeSessionRecord = SessionSummary

export type ClaudeSessionReader = {
  list: () => Promise<unknown[]>
  get: (nativeId: string) => Promise<unknown>
}

function proofClaudeSessionReader(): ClaudeSessionReader | undefined {
  const fixture = process.env[SESSION_CLAUDE_SYNC_FIXTURE_ENV]
  if (fixture === undefined) return undefined
  const parsed = z
    .strictObject({ records: z.array(z.unknown()), delayMs: z.number().int().nonnegative() })
    .parse(JSON.parse(fixture))
  const pause = async () => {
    if (parsed.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, parsed.delayMs))
  }
  return {
    list: async () => {
      await pause()
      return parsed.records
    },
    get: async (nativeId) => {
      await pause()
      return parsed.records.find(
        (record) =>
          typeof record === 'object' &&
          record !== null &&
          'sessionId' in record &&
          record.sessionId === nativeId,
      )
    },
  }
}

function systemClaudeSessionReader(): ClaudeSessionReader {
  return {
    list: () => listSessions({ includeProgrammatic: false }),
    get: (nativeId) => getSessionInfo(nativeId),
  }
}

function parseClaudeSession(raw: unknown): ClaudeSessionRecord | null {
  const parsed = claudeSessionSchema.safeParse(raw)
  if (!parsed.success) return null
  return {
    nativeId: parsed.data.sessionId,
    activityAt: parsed.data.lastModified,
    ...(parsed.data.customTitle === undefined ? {} : { customTitle: parsed.data.customTitle }),
    ...(parsed.data.summary === '' ||
    parsed.data.summary === parsed.data.customTitle ||
    parsed.data.summary === parsed.data.firstPrompt
      ? {}
      : { preview: parsed.data.summary }),
    ...(parsed.data.firstPrompt === undefined ? {} : { firstPrompt: parsed.data.firstPrompt }),
    ...(parsed.data.cwd === undefined ? {} : { cwd: parsed.data.cwd }),
  }
}

async function readClaudeSessions(request: {
  reader: ClaudeSessionReader
  knownNativeIds: readonly string[]
  reportMalformed: (raw: unknown) => void
}): Promise<ClaudeSessionRecord[]> {
  const listed = await request.reader.list()
  const records = new Map<string, ClaudeSessionRecord>()
  for (const raw of listed) {
    const record = parseClaudeSession(raw)
    if (record === null) request.reportMalformed(raw)
    else records.set(record.nativeId, record)
  }
  for (const nativeId of request.knownNativeIds) {
    if (records.has(nativeId)) continue
    const raw = await request.reader.get(nativeId)
    if (raw === undefined) continue
    const record = parseClaudeSession(raw)
    if (record === null) request.reportMalformed(raw)
    else records.set(record.nativeId, record)
  }
  return [...records.values()]
}

export async function listClaudeSessionSummaries(
  input: SessionSummaryListInput & { reader?: ClaudeSessionReader },
): Promise<SessionSummaryListResult> {
  let skipped = 0
  const records = await readClaudeSessions({
    reader: input.reader ?? proofClaudeSessionReader() ?? systemClaudeSessionReader(),
    knownNativeIds: input.knownNativeIds,
    reportMalformed: () => {
      skipped += 1
    },
  })
  return { records, skipped }
}

export async function getClaudeSessionSummary(
  nativeId: string,
  reader: ClaudeSessionReader = proofClaudeSessionReader() ?? systemClaudeSessionReader(),
): Promise<ClaudeSessionRecord | null> {
  const raw = await reader.get(nativeId)
  if (raw === undefined) return null
  const record = parseClaudeSession(raw)
  if (record === null)
    console.warn(`Rejected an unrecognised Claude Session summary for ${nativeId}.`)
  return record
}
