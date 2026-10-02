import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTail } from '@/domains/sessions/api/session-history'
import type { CodexRequest } from '../app-server'
import { readCodexNickname } from './codex-subagent-nicknames'
import {
  type CodexTurn,
  codexTurnContent,
  codexTurnPages,
  readCodexTurnPage,
} from './codex-turn-pages'

// Each spawned thread is read for the nickname Codex gave it; no history item carries it.
function withNicknames(request: CodexRequest, content: FeedContent[]): Promise<FeedContent[]> {
  return Promise.all(
    content.map(async (entry) => {
      if (entry.kind !== 'delegation') return entry
      const nickname = await readCodexNickname(request, entry.agentId)
      return nickname ? { ...entry, nickname } : entry
    }),
  )
}

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const pages = codexTurnPages(request, {
    threadId: nativeId,
    itemsView: 'full',
    sortDirection: 'asc',
  })
  let rejected = 0
  const content: FeedContent[] = []
  for await (const turns of pages) {
    for (const turn of turns) content.push(...codexTurnContent(turn, () => (rejected += 1)))
  }
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex history shape(s).`)
  return withNicknames(request, content)
}

// Turns to a newest-first page; Codex Desktop asks for 5, and a Feed page wants about 200 rows.
export const CODEX_TAIL_TURNS = 10
// Each wider read holds four times the pages, so a deep page costs few reads of the newest one.
const TAIL_GROWTH = 4
// Threads whose loaded Turns stay between opens, per app-server client.
const CACHED_THREADS = 32
// 10,000 Turns; a thread past it, or a cursor that comes back, is a read that would never end.
const MAX_TAIL_PAGES = 1_000

// A thread's newest Turns, oldest first, and the cursor to the page before them; null at the start.
type LoadedThread = { turns: CodexTurn[]; olderCursor: string | null; pages: number }

const loadedByClient = new WeakMap<CodexRequest, Map<string, LoadedThread>>()
// A Turn object kept between reads decodes once.
const decodedTurns = new WeakMap<CodexTurn, FeedContent[]>()

function newestFirst(request: CodexRequest, threadId: string, cursor: string | null) {
  return readCodexTurnPage(request, {
    threadId,
    itemsView: 'full',
    sortDirection: 'desc',
    limit: CODEX_TAIL_TURNS,
    cursor,
  })
}

// The newest page again, joined to the Turns already loaded at the first Turn both hold. With no
// such Turn among the pages back to the loaded ones, the thread is read again from its newest end.
async function refreshNewest(
  request: CodexRequest,
  threadId: string,
  loaded: LoadedThread | undefined,
): Promise<LoadedThread> {
  const known = new Map(loaded?.turns.map((turn, index) => [turn.id, index]))
  const newer: CodexTurn[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  for (let pages = 1; pages <= MAX_TAIL_PAGES; pages += 1) {
    const page = await newestFirst(request, threadId, cursor)
    for (const turn of page.turns) {
      const at = known.get(turn.id)
      if (at !== undefined && loaded !== undefined) {
        const turns = [...loaded.turns.slice(0, at), turn, ...newer.reverse()]
        return { ...loaded, turns }
      }
      newer.push(turn)
    }
    cursor = page.nextCursor
    if (cursor === null || loaded === undefined)
      return { turns: newer.reverse(), olderCursor: cursor, pages }
    if (seen.has(cursor)) throw new Error(`Codex thread ${threadId} repeated a page cursor.`)
    seen.add(cursor)
  }
  throw new Error(`Codex thread ${threadId} has more than ${MAX_TAIL_PAGES} pages.`)
}

async function readOlder(request: CodexRequest, threadId: string, loaded: LoadedThread) {
  if (loaded.olderCursor === null) return loaded
  const page = await newestFirst(request, threadId, loaded.olderCursor)
  const known = new Set(loaded.turns.map(({ id }) => id))
  const older = page.turns.filter(({ id }) => !known.has(id)).reverse()
  return {
    turns: [...older, ...loaded.turns],
    olderCursor: page.nextCursor,
    pages: loaded.pages + 1,
  }
}

function turnContent(turn: CodexTurn, onRejected: () => void): FeedContent[] {
  let content = decodedTurns.get(turn)
  if (content === undefined) {
    content = codexTurnContent(turn, onRejected)
    decodedTurns.set(turn, content)
  }
  return content
}

// A thread's newest Turns, `4 ** extent` pages of them at least, asked for newest first. The Turns
// read before stay between opens; each read asks again only for the newest page, so a Turn that
// grew is read again and the older ones are not.
export async function readCodexSessionTail(
  request: CodexRequest,
  threadId: string,
  extent: number,
): Promise<SessionHistoryTail> {
  const threads = loadedByClient.get(request) ?? new Map<string, LoadedThread>()
  loadedByClient.set(request, threads)
  let loaded = await refreshNewest(request, threadId, threads.get(threadId))
  const seen = new Set<string>()
  while (loaded.pages < TAIL_GROWTH ** extent && loaded.olderCursor !== null) {
    if (seen.has(loaded.olderCursor))
      throw new Error(`Codex thread ${threadId} repeated a page cursor.`)
    if (loaded.pages >= MAX_TAIL_PAGES)
      throw new Error(`Codex thread ${threadId} has more than ${MAX_TAIL_PAGES} pages.`)
    seen.add(loaded.olderCursor)
    loaded = await readOlder(request, threadId, loaded)
  }
  threads.delete(threadId)
  threads.set(threadId, loaded)
  for (const key of threads.keys()) if (threads.size > CACHED_THREADS) threads.delete(key)
  let rejected = 0
  const content = loaded.turns.flatMap((turn) => turnContent(turn, () => (rejected += 1)))
  if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex history shape(s).`)
  return { content: await withNicknames(request, content), complete: loaded.olderCursor === null }
}

// Newest first, so a Turn just started is found on the first page.
export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const pages = codexTurnPages(request, {
    threadId: nativeId,
    itemsView: 'notLoaded',
    sortDirection: 'desc',
  })
  for await (const turns of pages) if (turns.some((turn) => turn.id === turnId)) return true
  return false
}
