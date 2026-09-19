// Indexing older history a bounded batch at a time (#2373). The recent window is kept warm by
// every Roster read; backfill is what carries the rest of a CLI's history into the index without
// ever reading the whole tree in one pass. A batch never repeats a file another batch already
// covered and never skips one, because "already covered" is a place in the newest-first order
// (a written time and a path), not a position in an array that new Sessions keep shifting.
import type {
  BackfillProgress,
  SessionIndex,
  TranscriptFileIdentity,
} from '@/domains/sessions/main/session-index/contract'
import type { IndexedWindowSource } from '@/domains/sessions/main/session-index/indexed-window'
import { reindexCandidates } from '@/domains/sessions/main/session-index/reindex-pass'

type Boundary = NonNullable<BackfillProgress['boundary']>

// The newest-first total order backfill walks: written time, then path to break a tie between
// files sharing one mtime (coarse filesystem timestamps, or a fixture that writes a batch at once).
function isNewerOrAtBoundary(file: TranscriptFileIdentity, boundary: Boundary): boolean {
  if (file.writtenAt !== boundary.writtenAt) return file.writtenAt > boundary.writtenAt
  return file.path <= boundary.path
}

export type BackfillSlice = { batch: TranscriptFileIdentity[]; complete: boolean }

// The next batch past `boundary`, and whether it reaches the oldest file in `listing`. `listing`
// need not be sorted: this canonicalises its own order rather than trusting the caller's, because
// two files can share a written time and only this order treats that tie the same way every time.
export function nextBackfillSlice(
  listing: readonly TranscriptFileIdentity[],
  boundary: Boundary | null,
  batchSize: number,
): BackfillSlice {
  const ordered = [...listing].sort(
    (left, right) => right.writtenAt - left.writtenAt || left.path.localeCompare(right.path),
  )
  const startIndex =
    boundary === null ? 0 : ordered.findIndex((file) => !isNewerOrAtBoundary(file, boundary))
  if (boundary !== null && startIndex === -1) return { batch: [], complete: true }
  const batch = ordered.slice(startIndex, startIndex + batchSize)
  return { batch, complete: startIndex + batch.length >= ordered.length }
}

export type BackfillBatchResult = { progress: BackfillProgress; filesParsed: number }

export type BackfillBatchOptions = {
  pass: { source: IndexedWindowSource; index: SessionIndex }
  listing: readonly TranscriptFileIdentity[]
  progress: BackfillProgress
  batchSize: number
}

// One backfill batch: find the next slice past the persisted boundary, reindex whatever in it the
// index does not already hold unchanged, and report the new boundary to persist. An empty batch
// with `complete: true` is backfill catching up to a tree it has already fully walked.
export async function runBackfillBatch(
  options: BackfillBatchOptions,
): Promise<BackfillBatchResult> {
  const { pass, listing, progress, batchSize } = options
  const { batch, complete } = nextBackfillSlice(listing, progress.boundary, batchSize)
  if (batch.length === 0)
    return { progress: { boundary: progress.boundary, complete }, filesParsed: 0 }
  const reindexed = await reindexCandidates(pass, batch, listing)
  const last = batch.at(-1)
  if (last === undefined) throw new Error('Unreachable: batch was just checked non-empty.')
  return {
    progress: { boundary: { writtenAt: last.writtenAt, path: last.path }, complete },
    filesParsed: reindexed.parsedPaths.length,
  }
}
