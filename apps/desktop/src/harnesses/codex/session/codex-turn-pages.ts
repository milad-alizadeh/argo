import { z } from 'zod'
import type { CodexRequest, ThreadTurnsListParams } from '../app-server'

// The Codex history a page carries; `protocol-generated/v2/thread-turns-list-response.ts`.
const turnSchema = z.looseObject({
  id: z.string().min(1),
  items: z.array(z.looseObject({ type: z.string().min(1) })),
  completedAt: z.number().nullable(),
})
export const turnsPageSchema = z.looseObject({
  data: z.array(turnSchema),
  nextCursor: z.string().min(1).nullable(),
})
export type CodexTurn = z.infer<typeof turnSchema>

const TURN_PAGE_SIZE = 50

type TurnPageRequest = Pick<ThreadTurnsListParams, 'threadId' | 'itemsView' | 'sortDirection'>

// Every Turn of a thread, one `thread/turns/list` page at a time; a page that does not fit is
// reported and thrown, since a Feed missing a page would read as complete.
export async function* codexTurnPages(
  request: CodexRequest,
  params: TurnPageRequest,
): AsyncGenerator<CodexTurn[]> {
  let cursor: string | null = null
  do {
    const page = await request(
      'thread/turns/list',
      { ...params, limit: TURN_PAGE_SIZE, cursor },
      (value) => value,
    )
    const parsed = turnsPageSchema.safeParse(page)
    if (!parsed.success) {
      console.warn('Rejected 1 unrecognised Codex turns page.')
      throw parsed.error
    }
    yield parsed.data.data
    cursor = parsed.data.nextCursor
  } while (cursor !== null)
}
