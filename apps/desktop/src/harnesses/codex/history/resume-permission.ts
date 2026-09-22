import { statusOf } from '@/harnesses/codex/history/vendor-convert'
import {
  type HistoryTransport,
  LOADED_THREAD_LIST_METHOD,
  loadedSchema,
  PAGE_LIMIT,
  readSchema,
  STORED_THREAD_READ_METHOD,
} from '@/harnesses/codex/history/vendor-model'

function loadedIds(value: unknown): string[] {
  const parsed = loadedSchema.safeParse(value)
  if (!parsed.success) return []
  return parsed.data.data ?? parsed.data.threadIds ?? []
}

async function listLoadedIds(transport: HistoryTransport): Promise<string[]> {
  const ids: string[] = []
  let cursor: string | undefined
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const result = await transport.request(
      LOADED_THREAD_LIST_METHOD,
      cursor === undefined ? { limit: 50 } : { cursor, limit: 50 },
    )
    const parsed = loadedSchema.safeParse(result)
    if (!parsed.success) return ids
    ids.push(...loadedIds(result))
    if (parsed.data.nextCursor == null) return ids
    cursor = parsed.data.nextCursor
  }
  return ids
}

export async function readResumePermission(
  transport: HistoryTransport,
  threadId: string,
): Promise<{ resumable: true } | { resumable: false; reason: string }> {
  try {
    const result = await transport.request(STORED_THREAD_READ_METHOD, {
      threadId,
      includeTurns: false,
    })
    const parsed = readSchema.safeParse(result)
    if (!parsed.success) return { resumable: false, reason: 'Session history is unavailable.' }
    const status = statusOf(parsed.data.thread.status)
    const loaded: string[] = await listLoadedIds(transport).catch(() => [] as string[])
    if (status.type === 'systemError') {
      return { resumable: false, reason: status.message ?? 'Codex status is systemError.' }
    }
    const heldByVendor = status.type === 'active' || loaded.includes(threadId)
    if (heldByVendor) {
      return { resumable: false, reason: status.message ?? 'Codex status is active.' }
    }
    return { resumable: true }
  } catch (error) {
    return {
      resumable: false,
      reason: error instanceof Error ? error.message : 'Session history is unavailable.',
    }
  }
}
