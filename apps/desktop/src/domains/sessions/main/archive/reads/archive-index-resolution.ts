import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import { isSessionIndexFallback } from '../../indexing'
import type { SessionSource } from '../../observation'

export type IndexedResolution = {
  rows: SessionRosterRow[]
  unresolvedIds: string[]
  historyComplete: boolean
  recovering: boolean
}

// Every named id resolved off the index rather than a window, when every source has one open.
// `null` means at least one source has no index at all: the caller must grow a window instead.
export async function indexedResolution(
  sources: readonly SessionSource[],
  ids: readonly string[],
): Promise<IndexedResolution | null> {
  if (ids.length === 0)
    return { rows: [], unresolvedIds: [], historyComplete: true, recovering: false }
  if (sources.some((source) => source.resolveIndexedIds === undefined)) return null
  try {
    const resolved = await Promise.all(sources.map((source) => source.resolveIndexedIds?.(ids)))
    // Every source that carries `resolveIndexedIds` carries `historyComplete` too (both adapters
    // gate them on the same open index), so the guard above already proves this is defined.
    const completeness = await Promise.all(sources.map((source) => source.historyComplete?.()))
    const rows = resolved.flatMap((result) => result?.rows ?? [])
    const unresolvedIds = ids.filter((id) =>
      resolved.every((result) => result?.unresolvedIds.includes(id) ?? true),
    )
    return { rows, unresolvedIds, historyComplete: completeness.every(Boolean), recovering: false }
  } catch (error) {
    if (isSessionIndexFallback(error)) {
      return { rows: [], unresolvedIds: [...ids], historyComplete: false, recovering: true }
    }
    throw error
  }
}
