import { getSessionInfo, listSessions, type SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryListInput,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { SESSION_CLAUDE_SYNC_FIXTURE_ENV } from '../proof-protocol'

// Only the SDKSessionInfo fields discovery reads; the SDK types own the rest.
const claudeSessionSchema: z.ZodType<
  Pick<
    SDKSessionInfo,
    'sessionId' | 'summary' | 'lastModified' | 'customTitle' | 'firstPrompt' | 'cwd'
  >
> = z.object({
  sessionId: z.string().uuid(),
  summary: z.string(),
  lastModified: z.number().int().nonnegative(),
  customTitle: z.string().optional(),
  firstPrompt: z.string().optional(),
  cwd: z.string().optional(),
})

export type ClaudeSessionReader = {
  list: typeof listSessions
  get: (nativeId: string) => Promise<SDKSessionInfo | undefined>
}

function proofClaudeSessionReader(): ClaudeSessionReader | undefined {
  const fixture = process.env[SESSION_CLAUDE_SYNC_FIXTURE_ENV]
  if (fixture === undefined) return undefined
  // An object here; claudeSessionSchema checks its fields, as it does a listed one.
  const sessionObject = z.custom<SDKSessionInfo>(
    (value) => typeof value === 'object' && value !== null,
  )
  const parsed = z
    .strictObject({
      records: z.array(sessionObject),
      delayMs: z.number().int().nonnegative(),
    })
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
      return parsed.records.find((record) => record.sessionId === nativeId)
    },
  }
}

function systemClaudeSessionReader(): ClaudeSessionReader {
  return {
    list: () => listSessions({ includeProgrammatic: false }),
    get: (nativeId) => getSessionInfo(nativeId),
  }
}

function parseClaudeSession(raw: SDKSessionInfo): SessionSummary | null {
  const parsed = claudeSessionSchema.safeParse(raw)
  if (!parsed.success) return null
  const { sessionId, lastModified, summary, customTitle, firstPrompt, cwd } = parsed.data
  return {
    nativeId: sessionId,
    activityAt: lastModified,
    ...(customTitle === undefined ? {} : { customTitle }),
    ...(summary === '' || summary === customTitle || summary === firstPrompt
      ? {}
      : { preview: summary }),
    ...(firstPrompt === undefined ? {} : { firstPrompt }),
    ...(cwd === undefined ? {} : { cwd }),
  }
}

export async function listClaudeSessionSummaries(
  input: SessionSummaryListInput & { reader?: ClaudeSessionReader },
): Promise<SessionSummaryListResult> {
  const reader = input.reader ?? proofClaudeSessionReader() ?? systemClaudeSessionReader()
  const records = new Map<string, SessionSummary>()
  let skipped = 0
  const remember = (session: SDKSessionInfo) => {
    const record = parseClaudeSession(session)
    if (record === null) skipped += 1
    else records.set(record.nativeId, record)
  }
  for (const session of await reader.list()) remember(session)
  for (const nativeId of input.knownNativeIds) {
    if (records.has(nativeId)) continue
    const session = await reader.get(nativeId)
    if (session !== undefined) remember(session)
  }
  return { records: [...records.values()], skipped }
}

export async function getClaudeSessionSummary(
  nativeId: string,
  reader: ClaudeSessionReader = proofClaudeSessionReader() ?? systemClaudeSessionReader(),
): Promise<SessionSummary | null> {
  const raw = await reader.get(nativeId)
  if (raw === undefined) return null
  const record = parseClaudeSession(raw)
  if (record === null)
    console.warn(`Rejected an unrecognised Claude Session summary for ${nativeId}.`)
  return record
}
