import { z } from 'zod'
import type {
  SessionAvailability,
  SessionHistoryEntry,
} from '@/domains/sessions/contract/session-history'
import type { CodexRequest } from '../app-server/codex-app-server-machine'

const itemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('userMessage'),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  }),
  z.object({ id: z.string().min(1), type: z.literal('agentMessage'), text: z.string() }),
])
const threadReadSchema = z.object({
  thread: z.object({
    id: z.string().min(1),
    status: z.discriminatedUnion('type', [
      z.object({ type: z.literal('idle') }),
      z.object({ type: z.literal('active'), activeFlags: z.array(z.string()) }),
      z.object({ type: z.literal('notLoaded') }),
      z.object({ type: z.literal('systemError') }),
    ]),
    turns: z.array(z.object({ id: z.string().min(1), items: z.array(z.unknown()) })),
  }),
})

export type CodexHistory = {
  availability: SessionAvailability
  entries: SessionHistoryEntry[]
  active: boolean
}

const loadedListSchema = z.object({
  data: z.array(z.string().min(1)),
  nextCursor: z.string().nullable().optional(),
})

function availability(
  status: z.infer<typeof threadReadSchema>['thread']['status'],
): SessionAvailability {
  switch (status.type) {
    case 'idle':
      return { state: 'available', reason: null }
    case 'active':
      return { state: 'unknown', reason: 'Codex is checking where this Session is active.' }
    case 'notLoaded':
    case 'systemError':
      return { state: 'unknown', reason: 'Codex could not confirm this Session availability.' }
  }
}

export function parseCodexHistory(value: unknown, nativeId: string): CodexHistory {
  const result = threadReadSchema.parse(value)
  if (result.thread.id !== nativeId) throw new Error('Codex read a different Session.')
  const entries = result.thread.turns.flatMap(({ items }) =>
    items.flatMap<SessionHistoryEntry>((raw) => {
      const item = itemSchema.safeParse(raw)
      if (!item.success) return []
      switch (item.data.type) {
        case 'userMessage': {
          const text = item.data.content.map((content) => content.text).join('')
          return text === '' ? [] : [{ sourceId: item.data.id, role: 'user' as const, text }]
        }
        case 'agentMessage':
          return item.data.text === ''
            ? []
            : [{ sourceId: item.data.id, role: 'assistant' as const, text: item.data.text }]
      }
      return []
    }),
  )
  return {
    availability: availability(result.thread.status),
    entries,
    active: result.thread.status.type === 'active',
  }
}

async function loadedThreadIds(request: CodexRequest): Promise<Set<string>> {
  const ids = new Set<string>()
  const cursors = new Set<string>()
  let cursor: string | null = null
  do {
    const page: z.infer<typeof loadedListSchema> = await request(
      'thread/loaded/list',
      { cursor, limit: 100 },
      (value) => loadedListSchema.parse(value),
    )
    for (const id of page.data) ids.add(id)
    cursor = page.nextCursor ?? null
    if (cursor !== null) {
      if (cursors.has(cursor)) throw new Error('Codex repeated a loaded-thread cursor.')
      cursors.add(cursor)
    }
  } while (cursor !== null)
  return ids
}

export async function readCodexHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<CodexHistory> {
  const history = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => parseCodexHistory(value, nativeId),
  )
  if (!history.active) return history
  try {
    const loaded = await loadedThreadIds(request)
    return {
      ...history,
      availability: loaded.has(nativeId)
        ? { state: 'unknown', reason: 'Codex has not confirmed whether this Session can resume.' }
        : { state: 'unavailable', reason: 'This Codex Session is active in another app.' },
    }
  } catch {
    return {
      ...history,
      availability: { state: 'unknown', reason: 'Codex could not confirm Session availability.' },
    }
  }
}
