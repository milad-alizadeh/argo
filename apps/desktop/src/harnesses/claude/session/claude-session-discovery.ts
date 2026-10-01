import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  getSessionInfo,
  listSessions,
  listSubagents,
  type SDKSessionInfo,
} from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  SessionSubagentLink,
  SessionSummary,
  SessionSummaryListInput,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { identifierSchema } from '@/shared/validation'
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
  listSubagents: (nativeId: string, cwd: string | null) => Promise<string[]>
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
      // While this file exists, every read waits, so a proof can hold a sync mid-scan.
      holdFile: z.string().optional(),
    })
    .parse(JSON.parse(fixture))
  const pause = async () => {
    while (parsed.holdFile !== undefined && existsSync(parsed.holdFile)) await sleep(20)
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
    listSubagents: async () => [],
  }
}

function systemClaudeSessionReader(): ClaudeSessionReader {
  return {
    list: () => listSessions({ includeProgrammatic: false }),
    get: (nativeId) => getSessionInfo(nativeId),
    listSubagents: (nativeId, cwd) => listSubagents(nativeId, cwd === null ? {} : { dir: cwd }),
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

async function childLinks(
  reader: ClaudeSessionReader,
  session: SessionSummary,
): Promise<{ links: SessionSubagentLink[]; skipped: number }> {
  try {
    const childIds: unknown = await reader.listSubagents(session.nativeId, session.cwd ?? null)
    if (!Array.isArray(childIds)) throw new Error('The SDK returned no Subagent ID list.')
    const links: SessionSubagentLink[] = []
    let skipped = 0
    for (const nativeId of new Set(childIds)) {
      if (identifierSchema.safeParse(nativeId).success)
        links.push({ nativeId, parentNativeId: session.nativeId })
      else skipped += 1
    }
    return { links, skipped }
  } catch (error) {
    console.warn(`Could not list Claude Subagents for ${session.nativeId}:`, error)
    return { links: [], skipped: 1 }
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
  const sessions = [...records.values()]
  const subagents: SessionSubagentLink[] = []
  for (let offset = 0; offset < sessions.length; offset += 4) {
    const batch = await Promise.all(
      sessions.slice(offset, offset + 4).map((session) => childLinks(reader, session)),
    )
    for (const result of batch) {
      subagents.push(...result.links)
      skipped += result.skipped
    }
  }
  return {
    records: [...records.values()],
    skipped,
    ...(subagents.length === 0 ? {} : { subagents }),
  }
}

export async function getClaudeSessionSummary(
  nativeId: string,
  reader: Pick<ClaudeSessionReader, 'get'> = proofClaudeSessionReader() ??
    systemClaudeSessionReader(),
): Promise<SessionSummary | null> {
  const raw = await reader.get(nativeId)
  if (raw === undefined) return null
  const record = parseClaudeSession(raw)
  if (record === null)
    console.warn(`Rejected an unrecognised Claude Session summary for ${nativeId}.`)
  return record
}
