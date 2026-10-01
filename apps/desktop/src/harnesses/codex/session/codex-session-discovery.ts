import { z } from 'zod'
import type {
  SessionSubagentLink,
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import {
  type CodexRequest,
  CodexUnavailableError,
  isThreadNotLoaded,
  type Thread,
  type ThreadListParams,
  type ThreadListResponse,
} from '../app-server'

type ThreadSourceKind = NonNullable<ThreadListParams['sourceKinds']>[number]

const interactiveAndSubagentSourceKinds = [
  'cli',
  'vscode',
  'appServer',
  'subAgent',
  'subAgentReview',
  'subAgentCompact',
  'subAgentThreadSpawn',
  'subAgentOther',
] satisfies ThreadSourceKind[]

// Only the Thread fields discovery reads; the generated types own the rest.
const threadSchema: z.ZodType<
  Pick<Thread, 'id' | 'updatedAt' | 'parentThreadId'> &
    Partial<Pick<Thread, 'name' | 'preview' | 'cwd' | 'model' | 'reasoningEffort'>>
> = z.object({
  id: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  parentThreadId: z.string().nullable(),
  name: z.string().nullable().optional(),
  preview: z.string().optional(),
  cwd: z.string().optional(),
  model: z.string().nullable().optional(),
  reasoningEffort: z.string().nullable().optional(),
})
const pageSchema: z.ZodType<Pick<ThreadListResponse, 'nextCursor'> & { data: unknown[] }> =
  z.object({ data: z.array(z.unknown()), nextCursor: z.string().nullable() })

type ParsedThread =
  | { kind: 'session'; summary: SessionSummary }
  | { kind: 'subagent'; nativeId: string; parentNativeId: string }
  | { kind: 'unrecognised' }

type ThreadCollections = {
  records: Map<string, SessionSummary>
  subagents: Map<string, SessionSubagentLink>
}

function rootParentOf(
  nativeId: string,
  subagents: ReadonlyMap<string, SessionSubagentLink>,
): string | null {
  const visited = new Set([nativeId])
  let parentNativeId = subagents.get(nativeId)?.parentNativeId
  while (parentNativeId !== undefined && subagents.has(parentNativeId)) {
    if (visited.has(parentNativeId)) return null
    visited.add(parentNativeId)
    parentNativeId = subagents.get(parentNativeId)?.parentNativeId
  }
  return parentNativeId ?? null
}

function parseThread(raw: unknown): ParsedThread {
  const parsed = threadSchema.safeParse(raw)
  if (!parsed.success) return { kind: 'unrecognised' }
  const thread = parsed.data
  if (thread.parentThreadId !== null)
    return { kind: 'subagent', nativeId: thread.id, parentNativeId: thread.parentThreadId }
  return {
    kind: 'session',
    summary: {
      nativeId: thread.id,
      activityAt: thread.updatedAt * 1000,
      ...(thread.name === undefined ? {} : { customTitle: thread.name }),
      ...(thread.preview === undefined ? {} : { preview: thread.preview }),
      ...(thread.cwd === undefined ? {} : { cwd: thread.cwd }),
      // A thread records no Mode; a live channel saves the one it ran with.
      ...(thread.model == null && thread.reasoningEffort == null
        ? {}
        : {
            turnConfiguration: {
              model: thread.model ?? null,
              effort: thread.reasoningEffort ?? null,
              mode: null,
            },
          }),
    },
  }
}

function rememberThread(thread: ParsedThread, collections: ThreadCollections): number {
  switch (thread.kind) {
    case 'session':
      if (!collections.subagents.has(thread.summary.nativeId))
        collections.records.set(thread.summary.nativeId, {
          ...collections.records.get(thread.summary.nativeId),
          ...thread.summary,
        })
      return 0
    case 'subagent':
      collections.subagents.set(thread.nativeId, {
        nativeId: thread.nativeId,
        parentNativeId: thread.parentNativeId,
      })
      collections.records.delete(thread.nativeId)
      return 0
    case 'unrecognised':
      return 1
    default:
      return thread satisfies never
  }
}

// A found thread carries a null record when its shape is unrecognised.
async function readCodexThread(
  request: CodexRequest,
  nativeId: string,
): Promise<ParsedThread | { kind: 'missing' }> {
  try {
    const thread = await request(
      'thread/read',
      { threadId: nativeId, includeTurns: false },
      (value) => z.object({ thread: z.unknown() }).parse(value).thread,
    )
    return parseThread(thread)
  } catch (error) {
    // An id Codex cannot parse names no thread it could ever return (0.157.0 answers -32600).
    const missing =
      error instanceof Error &&
      /thread.*(?:not found|does not exist)|^invalid thread id:/i.test(error.message)
    if (missing || isThreadNotLoaded(error)) return { kind: 'missing' }
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
        sourceKinds: interactiveAndSubagentSourceKinds,
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

async function rememberKnownThreads(
  request: CodexRequest,
  knownNativeIds: readonly string[],
  collections: ThreadCollections,
): Promise<number> {
  let skipped = 0
  for (const nativeId of knownNativeIds) {
    if (collections.records.has(nativeId) || collections.subagents.has(nativeId)) continue
    const thread = await readCodexThread(request, nativeId)
    if (thread.kind !== 'missing') skipped += rememberThread(thread, collections)
  }
  return skipped
}

async function collectCodexThreads(
  request: CodexRequest,
  knownNativeIds: readonly string[],
): Promise<{ collections: ThreadCollections; skipped: number } | null> {
  let threads: unknown[]
  try {
    threads = await listCodexThreads(request)
  } catch (error) {
    // A machine without Codex has no Codex Sessions; its scan is empty, not failed.
    if (error instanceof CodexUnavailableError) return null
    throw error
  }
  const collections: ThreadCollections = { records: new Map(), subagents: new Map() }
  let skipped = 0
  for (const raw of threads) skipped += rememberThread(parseThread(raw), collections)
  skipped += await rememberKnownThreads(request, knownNativeIds, collections)
  return { collections, skipped }
}

export function createCodexSessionSummaryList(request: CodexRequest): SessionSummaryList {
  return async ({ knownNativeIds }) => {
    const result = await collectCodexThreads(request, knownNativeIds)
    if (result === null) return { records: [], skipped: 0 }
    const { collections, skipped: threadSkips } = result
    const subagents = [...collections.subagents.keys()].flatMap((nativeId) => {
      const parentNativeId = rootParentOf(nativeId, collections.subagents)
      return parentNativeId === null ? [] : [{ nativeId, parentNativeId }]
    })
    const skipped = threadSkips + collections.subagents.size - subagents.length
    return {
      records: [...collections.records.values()],
      skipped,
      ...(subagents.length === 0 ? {} : { subagents }),
    }
  }
}

export function createCodexSessionSummaryReader(request: CodexRequest): SessionSummaryReader {
  return async (nativeId) => {
    const thread = await readCodexThread(request, nativeId)
    switch (thread.kind) {
      case 'missing':
      case 'subagent':
        return null
      case 'unrecognised':
        console.warn(`Rejected an unrecognised Codex Session summary for ${nativeId}.`)
        return null
      case 'session':
        return thread.summary
      default:
        return thread satisfies never
    }
  }
}
