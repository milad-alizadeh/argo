import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import {
  FEED_PAGE_BYTE_LIMIT,
  FEED_PAGE_ITEM_LIMIT,
  isSessionFeedPagesCursor,
} from '@/domains/sessions/main/api/session-feed-pages'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { codexContentFromItems } from './codex-session-history'

const turnsPageSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1), items: z.array(z.unknown()) })),
  nextCursor: z.string().nullable(),
})
const cursorSchema = z.strictObject({
  version: z.literal(1),
  threadId: z.string().min(1),
  vendorCursor: z.string().nullable(),
  endIndex: z.number().int().nonnegative().nullable(),
  turnId: z.string().nullable(),
})
type PageCursor = z.infer<typeof cursorSchema>
export type CodexHistoryPage = { content: FeedContent[]; olderCursor: string | null }

function decodeCursor(before: string | null, threadId: string): PageCursor {
  if (before === null)
    return { version: 1, threadId, vendorCursor: null, endIndex: null, turnId: null }
  try {
    const decoded = cursorSchema.parse(
      JSON.parse(Buffer.from(before, 'base64url').toString('utf8')),
    )
    if (decoded.threadId !== threadId) throw new Error('wrong thread')
    return decoded
  } catch {
    throw new Error('invalid-feed-cursor')
  }
}

function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/requires experimentalApi capability|not available for this Codex version/i.test(
      error.message,
    ) ||
      ('code' in error && error.code === -32601))
  )
}

async function readTurnPage(request: CodexRequest, threadId: string, cursor: string | null) {
  try {
    return await request(
      'thread/turns/list',
      { threadId, cursor, limit: 1, sortDirection: 'desc', itemsView: 'full' },
      (value) => turnsPageSchema.parse(value),
    )
  } catch (error) {
    if (isUnavailable(error)) return null
    throw error
  }
}

type PageState = { cursor: PageCursor; content: FeedContent[]; bytes: number }

function unavailablePage(before: string | null): null {
  if (before !== null) throw new Error('expired-feed-cursor')
  return null
}

function appendTurn(
  state: PageState,
  turn: z.infer<typeof turnsPageSchema>['data'][number],
): string | null {
  const { cursor, content } = state
  if (cursor.turnId !== null && cursor.turnId !== turn.id) throw new Error('expired-feed-cursor')
  const items = codexContentFromItems(turn.items, `${cursor.threadId}:${turn.id}`)
  const end = cursor.endIndex ?? items.length
  if (end > items.length) throw new Error('expired-feed-cursor')
  for (let index = end - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item === undefined) continue
    const size = Buffer.byteLength(JSON.stringify(item), 'utf8')
    if (
      content.length > 0 &&
      (content.length >= FEED_PAGE_ITEM_LIMIT || state.bytes + size > FEED_PAGE_BYTE_LIMIT)
    )
      return encodeCursor({ ...cursor, endIndex: index + 1, turnId: turn.id })
    content.unshift(item)
    state.bytes += size
  }
  return null
}

export async function readCodexSessionPage(
  request: CodexRequest,
  threadId: string,
  before: string | null,
): Promise<CodexHistoryPage | null> {
  if (before !== null && isSessionFeedPagesCursor(before)) return null
  const state: PageState = { cursor: decodeCursor(before, threadId), content: [], bytes: 0 }
  while (true) {
    const page = await readTurnPage(request, threadId, state.cursor.vendorCursor)
    if (page === null) return unavailablePage(before)
    const turn = page.data[0]
    if (turn === undefined) return { content: state.content, olderCursor: null }
    const withinTurnCursor = appendTurn(state, turn)
    if (withinTurnCursor !== null) return { content: state.content, olderCursor: withinTurnCursor }
    if (page.nextCursor === null) return { content: state.content, olderCursor: null }
    state.cursor = { ...state.cursor, vendorCursor: page.nextCursor, endIndex: null, turnId: null }
    if (state.content.length >= FEED_PAGE_ITEM_LIMIT)
      return { content: state.content, olderCursor: encodeCursor(state.cursor) }
  }
}
