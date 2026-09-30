import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import type { CodexRequest } from '../app-server'

const threadSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable().optional(),
    preview: z.string().nullable().optional(),
    cwd: z.string().nullable().optional(),
    updatedAt: z.number().int().nonnegative(),
  })
  .passthrough()

const pageSchema = z.strictObject({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
  backwardsCursor: z.string().nullable().optional(),
})
const readSchema = z.strictObject({ thread: z.unknown() })
type CodexSessionRecord = SessionSummary

function rememberRecord(records: Map<string, CodexSessionRecord>, record: CodexSessionRecord) {
  records.set(record.nativeId, { ...records.get(record.nativeId), ...record })
}

function isMissingCodexThread(error: unknown): boolean {
  return error instanceof Error && /thread.*(?:not found|does not exist)/i.test(error.message)
}

function parseThread(raw: unknown): CodexSessionRecord | null {
  const parsed = threadSchema.safeParse(raw)
  if (!parsed.success) return null
  const thread = parsed.data
  return {
    nativeId: thread.id,
    activityAt: thread.updatedAt * 1000,
    ...(thread.name === undefined ? {} : { customTitle: thread.name }),
    ...(thread.preview === undefined ? {} : { preview: thread.preview }),
    ...(thread.cwd === undefined ? {} : { cwd: thread.cwd }),
  }
}

async function readListedCodexSessions(
  request: CodexRequest,
  reportMalformed: () => void,
): Promise<Map<string, CodexSessionRecord>> {
  const records = new Map<string, CodexSessionRecord>()
  let cursor: string | undefined
  do {
    const result = await request(
      'thread/list',
      {
        ...(cursor === undefined ? {} : { cursor }),
        limit: 100,
        sortKey: 'updated_at',
        sourceKinds: ['cli', 'vscode', 'appServer'],
        archived: false,
        useStateDbOnly: true,
      },
      (value) => pageSchema.parse(value),
    )
    for (const raw of result.data) {
      const record = parseThread(raw)
      if (record === null) reportMalformed()
      else rememberRecord(records, record)
    }
    cursor = result.nextCursor ?? undefined
  } while (cursor !== undefined)
  return records
}

async function readCodexThread(
  request: CodexRequest,
  nativeId: string,
): Promise<{ found: false } | { found: true; record: CodexSessionRecord | null }> {
  let result: z.infer<typeof readSchema>
  try {
    result = await request('thread/read', { threadId: nativeId, includeTurns: false }, (value) =>
      readSchema.parse(value),
    )
  } catch (error) {
    if (isMissingCodexThread(error)) return { found: false }
    throw error
  }
  return { found: true, record: parseThread(result.thread) }
}

async function readKnownCodexSessions(input: {
  request: CodexRequest
  knownNativeIds: readonly string[]
  records: Map<string, CodexSessionRecord>
  reportMalformed: () => void
}): Promise<void> {
  for (const nativeId of input.knownNativeIds) {
    if (input.records.has(nativeId)) continue
    const thread = await readCodexThread(input.request, nativeId)
    if (!thread.found) continue
    if (thread.record === null) input.reportMalformed()
    else rememberRecord(input.records, thread.record)
  }
}

export async function readCodexSessions(input: {
  request: CodexRequest
  knownNativeIds: readonly string[]
  reportMalformed: () => void
}): Promise<CodexSessionRecord[]> {
  const records = await readListedCodexSessions(input.request, input.reportMalformed)
  await readKnownCodexSessions({ ...input, records })
  return [...records.values()]
}

export function createCodexSessionSummaryList(request: CodexRequest): SessionSummaryList {
  return async ({ knownNativeIds }) => {
    let skipped = 0
    const records = await readCodexSessions({
      request,
      knownNativeIds,
      reportMalformed: () => {
        skipped += 1
      },
    })
    return { records, skipped }
  }
}

export function createCodexSessionSummaryReader(request: CodexRequest): SessionSummaryReader {
  return async (nativeId) => {
    const thread = await readCodexThread(request, nativeId)
    if (!thread.found) return null
    if (thread.record === null)
      console.warn(`Rejected an unrecognised Codex Session summary for ${nativeId}.`)
    return thread.record
  }
}
