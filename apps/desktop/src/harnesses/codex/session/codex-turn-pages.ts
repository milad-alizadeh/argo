import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest, ThreadItem, ThreadTurnsListParams } from '../app-server'
import { codexCollabFacts, codexFeedContent } from './codex-feed'

// The Codex history a page carries; `protocol-generated/v2/thread-turns-list-response.ts`.
const turnSchema = z.looseObject({
  id: z.string().min(1),
  items: z.array(z.looseObject({ type: z.string().min(1) })),
  completedAt: z.number().nullable(),
})
const turnsPageSchema = z.looseObject({
  data: z.array(turnSchema),
  nextCursor: z.string().min(1).nullable(),
})
export type CodexTurn = z.infer<typeof turnSchema>

const TURN_PAGE_SIZE = 50
// 50,000 Turns; a thread past it, or a cursor that comes back, is a read that would never end.
const MAX_TURN_PAGES = 1_000

type TurnPageRequest = Pick<ThreadTurnsListParams, 'threadId' | 'itemsView' | 'sortDirection'>
type TurnPage = { turns: CodexTurn[]; nextCursor: string | null }

// One `thread/turns/list` page; a page that does not fit is reported and thrown.
export async function readCodexTurnPage(
  request: CodexRequest,
  params: TurnPageRequest & Pick<ThreadTurnsListParams, 'limit' | 'cursor'>,
): Promise<TurnPage> {
  const page = await request('thread/turns/list', params, (value) => value)
  const parsed = turnsPageSchema.safeParse(page)
  if (!parsed.success) {
    console.warn('Rejected 1 unrecognised Codex turns page.')
    throw parsed.error
  }
  return { turns: parsed.data.data, nextCursor: parsed.data.nextCursor }
}

// Every Turn of a thread, page by page. A Feed missing a page would read as complete, so a read
// that cannot finish throws rather than stopping short.
export async function* codexTurnPages(
  request: CodexRequest,
  params: TurnPageRequest,
): AsyncGenerator<CodexTurn[]> {
  const seen = new Set<string>()
  let cursor: string | null = null
  let pages = 0
  do {
    pages += 1
    if (pages > MAX_TURN_PAGES) {
      console.warn(`Stopped a Codex history read past ${MAX_TURN_PAGES} pages.`)
      throw new Error(`Codex thread ${params.threadId} has more than ${MAX_TURN_PAGES} pages.`)
    }
    const page: TurnPage = await readCodexTurnPage(request, {
      ...params,
      limit: TURN_PAGE_SIZE,
      cursor,
    })
    yield page.turns
    cursor = page.nextCursor
    if (cursor === null) continue
    if (seen.has(cursor)) {
      console.warn('Stopped a Codex history read whose page cursor repeated.')
      throw new Error(`Codex thread ${params.threadId} repeated a page cursor.`)
    }
    seen.add(cursor)
  } while (cursor !== null)
}

// A Turn's Feed content; each item the mapping does not know is counted.
export function codexTurnContent(turn: CodexTurn, onRejected: () => void): FeedContent[] {
  // The generated `ThreadItem` union is the item shape.
  const items = turn.items as ThreadItem[]
  const collab = codexCollabFacts(items)
  return items.flatMap((item) => codexFeedContent(item, onRejected, collab.get(item.id)))
}
