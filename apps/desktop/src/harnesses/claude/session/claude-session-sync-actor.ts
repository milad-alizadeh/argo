import { getSessionInfo, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { fromPromise } from 'xstate'
import { z } from 'zod'
import type { SyncResult } from '@/domains/sessions/main/sync/session-sync-machine'

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

type ClaudeSessionRecord = SyncResult['records'][number]

type ClaudeSessionReader = {
  list: () => Promise<unknown[]>
  get: (nativeId: string) => Promise<unknown>
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

export const claudeSessionSyncActor = fromPromise<
  SyncResult,
  { knownNativeIds: string[]; reader?: ClaudeSessionReader }
>(async ({ input }) => {
  let skipped = 0
  const records = await readClaudeSessions({
    reader: input.reader ?? systemClaudeSessionReader(),
    knownNativeIds: input.knownNativeIds,
    reportMalformed: () => {
      skipped += 1
    },
  })
  return { records, skipped }
})
