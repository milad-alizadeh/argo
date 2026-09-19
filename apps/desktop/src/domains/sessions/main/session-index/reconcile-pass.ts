// Catching what a file watcher missed (#2373): a full-tree reconcile that reindexes only what
// `reindexCandidates` finds changed, chunked so one pass never asks SQLite for more `IN (...)`
// placeholders than it accepts. Launch, focus and system resume all trigger this, alongside the
// watcher's own settle signal — the same mechanism serves both, so there is one place that decides
// "changed" rather than a second one trusting an OS-reported filename.
import type {
  SessionIndex,
  TranscriptFileIdentity,
} from '@/domains/sessions/main/session-index/contract'
import type { IndexedWindowSource } from '@/domains/sessions/main/session-index/indexed-window'
import { reindexCandidates } from '@/domains/sessions/main/session-index/reindex-pass'

// SQLite's default `SQLITE_MAX_VARIABLE_NUMBER` is 999; a chunk stays comfortably under it so one
// `filesAt` call never needs more placeholders than a single chunk of candidates.
export const RECONCILE_CHUNK_SIZE = 500

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size)
    chunks.push(items.slice(start, start + size))
  return chunks
}

export type ReconcileResult = { filesParsed: number }

// Every file in `listing`, checked against the index and reindexed where it changed. Unlike a
// backfill batch, this never stops at a boundary: a reconcile pass either covers the whole tree it
// was handed or none of it, because a partial reconcile would leave a gap no boundary records.
export async function reconcileAll(
  pass: { source: IndexedWindowSource; index: SessionIndex },
  listing: readonly TranscriptFileIdentity[],
): Promise<ReconcileResult> {
  let filesParsed = 0
  for (const chunk of chunksOf(listing, RECONCILE_CHUNK_SIZE)) {
    const reindexed = await reindexCandidates(pass, chunk, listing)
    filesParsed += reindexed.parsedPaths.length
  }
  return { filesParsed }
}
