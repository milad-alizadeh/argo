import type { z } from 'zod'
import {
  CodexHistoryUnavailableError,
  type HistoryMethod,
  type HistoryTransport,
  ITEM_ROLES,
  type itemSchema,
  listSchema,
  PAGE_LIMIT,
  pageSchema,
  STATUS_TYPES,
  STORED_THREAD_LIST_METHOD,
  type StoredItem,
  type StoredThread,
  type StoredTurn,
  type statusSchema,
  TOOL_ITEMS,
  TURN_STATUSES,
  type threadSchema,
  type turnSchema,
  type VendorStatus,
} from './vendor-model'

export function statusOf(value: z.infer<typeof statusSchema> | undefined): VendorStatus {
  if (value === undefined) return { type: 'unknown' }
  const known = value.type in STATUS_TYPES
  return {
    type: known ? STATUS_TYPES[value.type as keyof typeof STATUS_TYPES] : 'unknown',
    ...(value.message === undefined ? {} : { message: value.message }),
    ...(value.activeFlags === undefined ? {} : { activeFlags: value.activeFlags }),
  }
}

function turnStatusOf(value: string | undefined): StoredTurn['status'] {
  if (value !== undefined && value in TURN_STATUSES) {
    return TURN_STATUSES[value as keyof typeof TURN_STATUSES]
  }
  return 'completed'
}

function toolStatusOf(value: string | undefined): StoredItem['status'] {
  if (value === 'completed' || value === 'failed') return value
  if (value === 'declined') return 'failed'
  return 'running'
}

function messageTextOf(item: z.infer<typeof itemSchema>): string {
  if (item.text !== undefined) return item.text
  return (item.content ?? [])
    .filter((input) => input.type === 'text')
    .map((input) => input.text ?? '')
    .join('')
}

function itemsOf(turnId: string, items: z.infer<typeof itemSchema>[]): StoredItem[] {
  const stored: StoredItem[] = []
  for (const item of items) {
    if (item.type in ITEM_ROLES) {
      stored.push({
        id: item.id,
        turnId,
        role: ITEM_ROLES[item.type as keyof typeof ITEM_ROLES],
        text: messageTextOf(item),
        name: item.type,
        status: 'completed',
      })
      continue
    }
    if (item.type in TOOL_ITEMS) {
      stored.push({
        id: item.id,
        turnId,
        role: 'tool',
        text: item.command ?? item.text ?? '',
        name: item.command ?? item.type,
        status: toolStatusOf(item.status),
      })
    }
  }
  return stored
}

export function turnsOf(turns: z.infer<typeof turnSchema>[] | undefined): StoredTurn[] {
  return (turns ?? []).map((turn) => ({
    id: turn.id,
    status: turnStatusOf(turn.status),
    startedAt: turn.startedAt ?? 0,
    items: itemsOf(turn.id, turn.items ?? []),
  }))
}

export function threadOf(thread: z.infer<typeof threadSchema>, turns = thread.turns): StoredThread {
  return {
    id: thread.id,
    cwd: thread.cwd ?? null,
    title: thread.name ?? thread.preview ?? null,
    branch: thread.branch ?? null,
    updatedAt: thread.updatedAt ?? null,
    status: statusOf(thread.status),
    turns: turnsOf(turns),
  }
}

export async function pagesOf(
  transport: HistoryTransport,
  method: HistoryMethod,
  first: Record<string, unknown>,
): Promise<{ data: unknown[]; nextCursor: string | null }[]> {
  const pages: { data: unknown[]; nextCursor: string | null }[] = []
  let cursor: string | undefined
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const result = await transport.request(
      method,
      cursor === undefined ? first : { ...first, cursor },
    )
    const parsed = (method === STORED_THREAD_LIST_METHOD ? listSchema : pageSchema).safeParse(
      result,
    )
    if (!parsed.success) throw new CodexHistoryUnavailableError()
    pages.push({ data: parsed.data.data, nextCursor: parsed.data.nextCursor ?? null })
    if (parsed.data.nextCursor == null) return pages
    cursor = parsed.data.nextCursor
  }
  throw new CodexHistoryUnavailableError()
}
