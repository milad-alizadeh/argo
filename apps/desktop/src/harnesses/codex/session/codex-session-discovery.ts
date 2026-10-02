import { z } from 'zod'
import type {
  SessionSubagentLink,
  SessionSummary,
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import { identifierSchema } from '@/shared/validation'
import {
  CODEX_SESSION_SOURCE_KINDS,
  type CodexRequest,
  CodexUnavailableError,
  isThreadNotLoaded,
  type SubAgentSource,
  type Thread,
  type ThreadListResponse,
} from '../app-server'

const subAgentSourceSchema: z.ZodType<SubAgentSource> = z.union([
  z.enum(['review', 'compact', 'memory_consolidation']),
  z.object({
    thread_spawn: z.object({
      parent_thread_id: identifierSchema,
      depth: z.number(),
      agent_path: z.string().nullable(),
      agent_nickname: z.string().nullable(),
      agent_role: z.string().nullable(),
    }),
  }),
  z.object({ other: z.string() }),
])
const sessionSourceSchema: z.ZodType<Thread['source']> = z.union([
  z.enum(['cli', 'vscode', 'exec', 'appServer', 'unknown']),
  z.object({ custom: z.string() }),
  z.object({ subAgent: subAgentSourceSchema }),
])

// Only the Thread fields discovery reads; the generated types own the rest.
const threadSchema: z.ZodType<
  Pick<Thread, 'id' | 'updatedAt' | 'parentThreadId'> &
    Partial<Pick<Thread, 'name' | 'preview' | 'cwd' | 'model' | 'reasoningEffort' | 'source'>>
> = z.object({
  id: identifierSchema,
  updatedAt: z.number().int().nonnegative(),
  parentThreadId: identifierSchema.nullable(),
  name: z.string().nullable().optional(),
  preview: z.string().optional(),
  cwd: z.string().optional(),
  model: z.string().nullable().optional(),
  reasoningEffort: z.string().nullable().optional(),
  source: sessionSourceSchema.optional(),
})
const pageSchema: z.ZodType<Pick<ThreadListResponse, 'nextCursor'> & { data: unknown[] }> =
  z.object({ data: z.array(z.unknown()), nextCursor: z.string().nullable() })

type ParsedThread =
  | { kind: 'session'; summary: SessionSummary }
  | { kind: 'subagent'; nativeId: string; parentNativeId: string }
  | { kind: 'parentlessSubagent'; nativeId: string }
  | { kind: 'unrecognised' }

type ThreadCollections = {
  records: Map<string, SessionSummary>
  subagents: Map<string, SessionSubagentLink>
  // Listed subagents whose parent only thread/read names.
  parentless: Set<string>
}

// thread/list leaves parentThreadId null for every subagent; only a spawn's source names its parent.
function sourceParentOf(source: SubAgentSource): string | null {
  if (typeof source === 'string')
    switch (source) {
      case 'review':
      case 'compact':
      case 'memory_consolidation':
        return null
      default:
        return source satisfies never
    }
  if ('thread_spawn' in source) return source.thread_spawn.parent_thread_id
  if ('other' in source) return null
  return source satisfies never
}

function subAgentSourceOf(source: Thread['source'] | undefined): SubAgentSource | null {
  return typeof source === 'object' && 'subAgent' in source ? source.subAgent : null
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
  const subAgentSource = subAgentSourceOf(thread.source)
  const parentNativeId =
    thread.parentThreadId ?? (subAgentSource === null ? null : sourceParentOf(subAgentSource))
  if (parentNativeId !== null) return { kind: 'subagent', nativeId: thread.id, parentNativeId }
  if (subAgentSource !== null) return { kind: 'parentlessSubagent', nativeId: thread.id }
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
      if (
        !collections.subagents.has(thread.summary.nativeId) &&
        !collections.parentless.has(thread.summary.nativeId)
      )
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
      collections.parentless.delete(thread.nativeId)
      return 0
    case 'parentlessSubagent':
      if (!collections.subagents.has(thread.nativeId)) collections.parentless.add(thread.nativeId)
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
        sourceKinds: [...CODEX_SESSION_SOURCE_KINDS],
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

async function rememberListedParents(
  request: CodexRequest,
  collections: ThreadCollections,
): Promise<void> {
  for (const nativeId of [...collections.parentless]) {
    const thread = await readCodexThread(request, nativeId)
    if (thread.kind === 'subagent') rememberThread(thread, collections)
    if (thread.kind === 'missing') collections.parentless.delete(nativeId)
  }
}

async function rememberKnownThreads(
  request: CodexRequest,
  knownNativeIds: readonly string[],
  collections: ThreadCollections,
): Promise<number> {
  let skipped = 0
  for (const nativeId of knownNativeIds) {
    if (
      collections.records.has(nativeId) ||
      collections.subagents.has(nativeId) ||
      collections.parentless.has(nativeId)
    )
      continue
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
  const collections: ThreadCollections = {
    records: new Map(),
    subagents: new Map(),
    parentless: new Set(),
  }
  let skipped = 0
  for (const raw of threads) skipped += rememberThread(parseThread(raw), collections)
  await rememberListedParents(request, collections)
  skipped += await rememberKnownThreads(request, knownNativeIds, collections)
  // A subagent no read gives a parent is neither a Session nor anyone's child.
  return { collections, skipped: skipped + collections.parentless.size }
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
      case 'parentlessSubagent':
        console.warn(`Rejected Codex subagent thread ${nativeId}, which names no parent.`)
        return null
      case 'session':
        return thread.summary
      default:
        return thread satisfies never
    }
  }
}
