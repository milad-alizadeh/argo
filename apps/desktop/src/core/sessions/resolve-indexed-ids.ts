// Resolving ids a caller already holds — archived, or asked for by restore — straight against the
// Session index's persisted resume graph (#2374). No discovery window to grow: an id this CLI's
// index has never named for want of backfill (#2373) comes back unresolved rather than falling
// through to a directory scan.
import { rootOf } from './chains'
import type { SessionRosterRow } from './models'
import type { SessionIndex } from './session-index/contract'
import type { createIndexedWindow } from './session-index/indexed-window'

export type ResolvedIndexedIds = { rows: SessionRosterRow[]; unresolvedIds: string[] }

export async function resolveIndexedIds(
  bound: ReturnType<typeof createIndexedWindow>,
  index: SessionIndex,
  ids: readonly string[],
): Promise<ResolvedIndexedIds> {
  await bound.ensureHydrated()
  const { history, cli } = bound.pass.source
  const chainIds = new Set<string>()
  const unresolvedIds: string[] = []
  for (const id of ids) {
    if (history.knownIds.has(id)) chainIds.add(rootOf(id, history.parents))
    else unresolvedIds.push(id)
  }
  const rows = chainIds.size === 0 ? [] : await index.rowsOfChains(cli, [...chainIds])
  return { rows, unresolvedIds }
}
