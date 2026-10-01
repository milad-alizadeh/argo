import { z } from 'zod'
import type {
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import type { CodexRequest, Thread, ThreadListResponse } from '../app-server'

// Only the Thread fields discovery reads; the generated types own the rest.
const threadSchema: z.ZodType<
  Pick<Thread, 'id' | 'updatedAt'> &
    Partial<Pick<Thread, 'name' | 'preview' | 'cwd' | 'model' | 'reasoningEffort'>>
> = z.object({
  id: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  name: z.string().nullable().optional(),
  preview: z.string().optional(),
  cwd: z.string().optional(),
  model: z.string().nullable().optional(),
  reasoningEffort: z.string().nullable().optional(),
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
    // A thread records no Mode; a live channel saves the one it ran with.
    ...(thread.model == null ? {} : { model: thread.model }),
    ...(thread.reasoningEffort == null ? {} : { effort: thread.reasoningEffort }),
  }
}

// A found thread carries a null record when its shape is unrecognised.
async function readCodexThread(
  request: CodexRequest,
  nativeId: string,
): Promise<{ found: false } | { found: true; record: SessionSummary | null }> {
  try {
    const thread = await request(
      'thread/read',
      { threadId: nativeId, includeTurns: false },
      (value) => z.object({ thread: z.unknown() }).parse(value).thread,
    )
    return { found: true, record: parseThread(thread) }
  } catch (error) {
    if (error instanceof Error && /thread.*(?:not found|does not exist)/i.test(error.message))
      return { found: false }
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
      const thread = await readCodexThread(request, nativeId)
      if (thread.found) remember(thread.record)
    }
    return { records: [...records.values()], skipped }
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
