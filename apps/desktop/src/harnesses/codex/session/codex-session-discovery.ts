import { z } from 'zod'
import type {
  SessionSubagentLink,
  SessionSummary,
  SessionSummaryList,
  SessionSummaryListInput,
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
import { codexTurnContent, codexTurnPages } from './codex-turn-pages'

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
const ordinarySourceSchema: z.ZodType<Exclude<Thread['source'], { subAgent: unknown }>> = z.union([
  z.enum(['cli', 'vscode', 'exec', 'appServer', 'unknown']),
  z.object({ custom: z.string() }),
])
const subAgentEnvelopeSchema = z.object({ subAgent: z.unknown() })

// Only the Thread fields discovery reads; the generated types own the rest. `sourceOf` reads source.
const threadSchema: z.ZodType<
  Pick<Thread, 'id' | 'updatedAt' | 'parentThreadId'> &
    Partial<Pick<Thread, 'name' | 'preview' | 'cwd' | 'model' | 'reasoningEffort'>> & {
      source?: unknown
    }
> = z.object({
  id: identifierSchema,
  updatedAt: z.number().int().nonnegative(),
  parentThreadId: identifierSchema.nullable(),
  name: z.string().nullable().optional(),
  preview: z.string().optional(),
  cwd: z.string().optional(),
  model: z.string().nullable().optional(),
  reasoningEffort: z.string().nullable().optional(),
  source: z.unknown().optional(),
})
const pageSchema: z.ZodType<Pick<ThreadListResponse, 'nextCursor'> & { data: unknown[] }> =
  z.object({ data: z.array(z.unknown()), nextCursor: z.string().nullable() })

type ParsedThread =
  | { kind: 'session'; summary: SessionSummary; sourceRecognised: boolean }
  | { kind: 'subagent'; nativeId: string; parentNativeId: string }
  | { kind: 'parentlessSubagent'; nativeId: string }
  | { kind: 'unrecognised' }

type ThreadCollections = {
  records: Map<string, SessionSummary>
  // Each listed subagent's parent, by native ID.
  subagents: Map<string, string>
  // Listed subagents whose parent only a thread/read names.
  awaitingParentRead: Set<string>
  // Sessions whose source this adapter does not know; kept as Sessions, then reported.
  unrecognisedSources: Set<string>
}

function isChildThread(collections: ThreadCollections, nativeId: string): boolean {
  return collections.subagents.has(nativeId) || collections.awaitingParentRead.has(nativeId)
}

type ThreadSource =
  | { kind: 'ordinary'; recognised: boolean }
  | { kind: 'subagent'; source: SubAgentSource }
  | { kind: 'unrecognisedSubagent' }

// Only a subAgent source makes a thread a child; any other source, even a new one, is a Session.
function sourceOf(source: unknown): ThreadSource {
  const envelope = subAgentEnvelopeSchema.safeParse(source)
  if (!envelope.success)
    return {
      kind: 'ordinary',
      recognised: source === undefined || ordinarySourceSchema.safeParse(source).success,
    }
  const subAgent = subAgentSourceSchema.safeParse(envelope.data.subAgent)
  return subAgent.success
    ? { kind: 'subagent', source: subAgent.data }
    : { kind: 'unrecognisedSubagent' }
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

function rootParentOf(nativeId: string, subagents: ReadonlyMap<string, string>): string | null {
  const visited = new Set([nativeId])
  let parentNativeId = subagents.get(nativeId)
  while (parentNativeId !== undefined && subagents.has(parentNativeId)) {
    if (visited.has(parentNativeId)) return null
    visited.add(parentNativeId)
    parentNativeId = subagents.get(parentNativeId)
  }
  return parentNativeId ?? null
}

// The first prompt a person wrote, read from the thread's Turns; envelopes are no prompt. A failed
// read leaves the row to its weaker title rather than failing the scan.
async function readFirstPrompt(request: CodexRequest, nativeId: string): Promise<string | null> {
  const pages = codexTurnPages(request, {
    threadId: nativeId,
    itemsView: 'summary',
    sortDirection: 'asc',
  })
  let rejected = 0
  let prompt: string | null = null
  try {
    for await (const turns of pages) {
      const content = turns.flatMap((turn) => codexTurnContent(turn, () => (rejected += 1)))
      const found = content.find(
        (entry) => entry.kind === 'message' && entry.role === 'user' && entry.text !== '',
      )
      if (found?.kind === 'message') {
        prompt = found.text
        break
      }
    }
  } catch (error) {
    if (!isThreadNotLoaded(error))
      console.warn(`Could not read the first Codex prompt for ${nativeId}:`, error)
  }
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex prompt shape(s).`)
  return prompt
}

// A thread records no Mode; a live channel saves the one it ran with.
function turnConfigurationOf(thread: { model?: string | null; reasoningEffort?: string | null }) {
  if (thread.model == null && thread.reasoningEffort == null) return {}
  return {
    turnConfiguration: {
      model: thread.model ?? null,
      effort: thread.reasoningEffort ?? null,
      mode: null,
    },
  }
}

async function parseThread(request: CodexRequest, raw: unknown): Promise<ParsedThread> {
  const parsed = threadSchema.safeParse(raw)
  if (!parsed.success) return { kind: 'unrecognised' }
  const thread = parsed.data
  const source = sourceOf(thread.source)
  if (source.kind === 'unrecognisedSubagent') return { kind: 'unrecognised' }
  const parentNativeId =
    thread.parentThreadId ?? (source.kind === 'subagent' ? sourceParentOf(source.source) : null)
  if (parentNativeId !== null) return { kind: 'subagent', nativeId: thread.id, parentNativeId }
  if (source.kind === 'subagent') return { kind: 'parentlessSubagent', nativeId: thread.id }
  const preview = thread.preview === '' ? undefined : thread.preview
  // Codex fills `preview` with the first prompt; only a thread it left unnamed and empty is read.
  const firstPrompt =
    thread.name === null && thread.preview === '' ? await readFirstPrompt(request, thread.id) : null
  return {
    kind: 'session',
    summary: {
      nativeId: thread.id,
      activityAt: thread.updatedAt * 1000,
      ...(thread.name === undefined ? {} : { customTitle: thread.name }),
      ...(preview === undefined ? {} : { preview }),
      ...(firstPrompt === null ? {} : { firstPrompt }),
      ...(thread.cwd === undefined ? {} : { cwd: thread.cwd }),
      ...turnConfigurationOf(thread),
    },
    sourceRecognised: source.recognised,
  }
}

function rememberThread(thread: ParsedThread, collections: ThreadCollections): number {
  switch (thread.kind) {
    case 'session':
      if (isChildThread(collections, thread.summary.nativeId)) return 0
      collections.records.set(thread.summary.nativeId, {
        ...collections.records.get(thread.summary.nativeId),
        ...thread.summary,
      })
      if (!thread.sourceRecognised) collections.unrecognisedSources.add(thread.summary.nativeId)
      return 0
    case 'subagent':
      collections.subagents.set(thread.nativeId, thread.parentNativeId)
      collections.records.delete(thread.nativeId)
      collections.awaitingParentRead.delete(thread.nativeId)
      return 0
    case 'parentlessSubagent':
      if (!collections.subagents.has(thread.nativeId))
        collections.awaitingParentRead.add(thread.nativeId)
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
  let thread: unknown
  try {
    thread = await request(
      'thread/read',
      { threadId: nativeId, includeTurns: false },
      (value) => z.object({ thread: z.unknown() }).parse(value).thread,
    )
  } catch (error) {
    // An id Codex cannot parse names no thread it could ever return (0.157.0 answers -32600).
    const missing =
      error instanceof Error &&
      /thread.*(?:not found|does not exist)|^invalid thread id:/i.test(error.message)
    if (missing || isThreadNotLoaded(error)) return { kind: 'missing' }
    throw error
  }
  return parseThread(request, thread)
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

// Returns how many reads were unrecognised. A Subagent stored under its parent needs no read.
async function rememberListedParents(
  request: CodexRequest,
  collections: ThreadCollections,
  knownSubagents: ReadonlySet<string>,
): Promise<number> {
  let skipped = 0
  for (const nativeId of [...collections.awaitingParentRead]) {
    if (knownSubagents.has(nativeId)) {
      collections.awaitingParentRead.delete(nativeId)
      continue
    }
    const thread = await readCodexThread(request, nativeId)
    switch (thread.kind) {
      case 'subagent':
        rememberThread(thread, collections)
        break
      case 'missing':
        collections.awaitingParentRead.delete(nativeId)
        break
      case 'unrecognised':
        collections.awaitingParentRead.delete(nativeId)
        skipped += rememberThread(thread, collections)
        break
      // The read names no parent either, so the thread stays out of the Sessions.
      case 'parentlessSubagent':
      case 'session':
        break
      default:
        return thread satisfies never
    }
  }
  return skipped
}

async function rememberKnownThreads(
  request: CodexRequest,
  knownNativeIds: readonly string[],
  collections: ThreadCollections,
): Promise<number> {
  let skipped = 0
  for (const nativeId of knownNativeIds) {
    if (collections.records.has(nativeId) || isChildThread(collections, nativeId)) continue
    const thread = await readCodexThread(request, nativeId)
    if (thread.kind !== 'missing') skipped += rememberThread(thread, collections)
  }
  return skipped
}

async function collectCodexThreads(
  request: CodexRequest,
  { knownNativeIds, knownSubagentNativeIds }: SessionSummaryListInput,
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
    awaitingParentRead: new Set(),
    unrecognisedSources: new Set(),
  }
  const knownSubagents = new Set(knownSubagentNativeIds)
  let skipped = 0
  for (const raw of threads) skipped += rememberThread(await parseThread(request, raw), collections)
  skipped += await rememberListedParents(request, collections, knownSubagents)
  const knownSessions = knownNativeIds.filter((nativeId) => !knownSubagents.has(nativeId))
  skipped += await rememberKnownThreads(request, knownSessions, collections)
  // A subagent no read gives a parent is neither a Session nor anyone's child.
  if (collections.awaitingParentRead.size > 0)
    console.warn(
      `Kept ${collections.awaitingParentRead.size} Codex subagent thread(s) that name no parent out of the Sessions.`,
    )
  if (collections.unrecognisedSources.size > 0)
    console.warn(
      `Kept ${collections.unrecognisedSources.size} Codex thread(s) with an unrecognised source as Sessions.`,
    )
  return { collections, skipped }
}

export function createCodexSessionSummaryList(request: CodexRequest): SessionSummaryList {
  return async (input) => {
    const result = await collectCodexThreads(request, input)
    if (result === null) return { records: [], skipped: 0 }
    const { collections, skipped: threadSkips } = result
    const linked: SessionSubagentLink[] = [...collections.subagents.keys()].flatMap((nativeId) => {
      const parentNativeId = rootParentOf(nativeId, collections.subagents)
      return parentNativeId === null ? [] : [{ nativeId, parentNativeId }]
    })
    const skipped = threadSkips + collections.subagents.size - linked.length
    // Saved with no parent; the next sync reads it again.
    const subagents = [
      ...linked,
      ...[...collections.awaitingParentRead].map((nativeId) => ({
        nativeId,
        parentNativeId: null,
      })),
    ]
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
        if (!thread.sourceRecognised)
          console.warn(`Kept Codex thread ${nativeId}, whose source is unrecognised, as a Session.`)
        return thread.summary
      default:
        return thread satisfies never
    }
  }
}
