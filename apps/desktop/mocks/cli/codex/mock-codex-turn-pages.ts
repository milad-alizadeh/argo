import type { CodexRequest } from '@/harnesses/codex/app-server'

// `thread/turns/list` as `protocol-generated/v2/thread-turns-list-params.ts` describes it: newest
// first unless asked otherwise, `limit` Turns to a page, and a cursor to the next page.
export function mockTurnsPage<Turn extends { items: unknown[] }>(
  turns: readonly Turn[],
  params: Record<string, unknown> = {},
) {
  const ordered = params.sortDirection === 'asc' ? [...turns] : [...turns].reverse()
  const start = typeof params.cursor === 'string' ? Number(params.cursor) : 0
  const end = typeof params.limit === 'number' ? start + params.limit : ordered.length
  const data = ordered
    .slice(start, end)
    .map((turn) =>
      params.itemsView === 'notLoaded' ? { ...turn, items: [], itemsView: 'notLoaded' } : turn,
    )
  const nextCursor = end < ordered.length ? String(end) : null
  return { data, nextCursor, backwardsCursor: null }
}

// A request that reads one thread as the app-server would: metadata, and its Turns page by page.
// A Turn left without an id or end time gets one.
export function mockTurnsRequest(
  turns: readonly ({ items: unknown[] } & Record<string, unknown>)[],
  metadata: object = {},
): CodexRequest {
  const complete = turns.map((turn, index) => ({
    id: `turn-${index + 1}`,
    completedAt: null,
    ...turn,
  }))
  return (async (
    method: string,
    params: Record<string, unknown>,
    parse: (value: unknown) => unknown,
  ) =>
    parse(
      method === 'thread/turns/list'
        ? mockTurnsPage(complete, params)
        : { thread: { ...metadata, turns: [] } },
    )) as CodexRequest
}
