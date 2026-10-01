import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import type { CodexRequest, Thread, ThreadListResponse } from '../app-server'

// Only the Thread fields discovery reads; the generated types own the rest.
const threadSchema: z.ZodType<
  Pick<Thread, 'id' | 'updatedAt'> & Partial<Pick<Thread, 'name' | 'preview' | 'cwd'>>
> = z.object({
  id: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  name: z.string().nullable().optional(),
  preview: z.string().optional(),
  cwd: z.string().optional(),
})
const pageSchema: z.ZodType<Pick<ThreadListResponse, 'nextCursor'> & { data: unknown[] }> =
  z.object({ data: z.array(z.unknown()), nextCursor: z.string().nullable() })

function parseThread(raw: unknown): SessionSummary | null {
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

// Undefined when Codex no longer stores the thread, null when its shape is unrecognised.
async function readCodexThread(
  request: CodexRequest,
  nativeId: string,
): Promise<SessionSummary | null | undefined> {
  try {
    const thread = await request(
      'thread/read',
      { threadId: nativeId, includeTurns: false },
      (value) => z.object({ thread: z.unknown() }).parse(value).thread,
    )
    return parseThread(thread)
  } catch (error) {
    if (error instanceof Error && /thread.*(?:not found|does not exist)/i.test(error.message))
      return undefined
    throw error
  }
}

async function listCodexThreads(request: CodexRequest): Promise<unknown[]> {
  const threads: unknown[] = []
  let cursor: string | undefined
  do {
    const page = await request(
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
    threads.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)
  return threads
}

export function createCodexSessionSummaryList(request: CodexRequest): SessionSummaryList {
  return async ({ knownNativeIds }) => {
    const records = new Map<string, SessionSummary>()
    let skipped = 0
    const remember = (record: SessionSummary | null) => {
      if (record === null) skipped += 1
      else records.set(record.nativeId, { ...records.get(record.nativeId), ...record })
    }
    for (const raw of await listCodexThreads(request)) remember(parseThread(raw))
    for (const nativeId of knownNativeIds) {
      if (records.has(nativeId)) continue
      const record = await readCodexThread(request, nativeId)
      if (record !== undefined) remember(record)
    }
    return { records: [...records.values()], skipped }
  }
}

export function createCodexSessionSummaryReader(request: CodexRequest): SessionSummaryReader {
  return async (nativeId) => {
    const record = await readCodexThread(request, nativeId)
    if (record === null)
      console.warn(`Rejected an unrecognised Codex Session summary for ${nativeId}.`)
    return record ?? null
  }
}
