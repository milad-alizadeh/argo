// One adapter's background indexing (#2373): one more backfill batch of older history, or a full
// reconcile pass, both sharing the bounded window's hydration so a resumed half never re-stitches
// against a history the window read has not filled. Split from `discover-transcript-sessions.ts`
// to keep that factory's own function short.
import { runBackfillBatch } from './backfill-pass'
import type { BackfillProgress, SessionIndex, TranscriptFileIdentity } from './contract'
import type { createIndexedWindow, IndexedWindowSource } from './indexed-window'
import { reconcileAll as reconcileCandidates } from './reconcile-pass'

export type IndexedWindowFor = (index: SessionIndex) => ReturnType<typeof createIndexedWindow>

export function createBackgroundIndexing(
  source: IndexedWindowSource,
  indexedWindowFor: IndexedWindowFor,
) {
  async function listingAt(root: string): Promise<TranscriptFileIdentity[]> {
    return source.identities(root)
  }

  // One more batch of older history: the persisted boundary past the recent window, or nothing
  // once every file on disk is at or newer than it.
  async function backfillTick(
    root: string,
    index: SessionIndex,
    batchSize: number,
  ): Promise<BackfillProgress> {
    const { pass, ensureHydrated } = indexedWindowFor(index)
    const progress = await index.backfillProgress(source.cli)
    if (progress.complete) return progress
    await ensureHydrated()
    const result = await runBackfillBatch({
      pass,
      listing: await listingAt(root),
      progress,
      batchSize,
    })
    await index.setBackfillProgress(source.cli, result.progress)
    return result.progress
  }

  // Every file in the tree, checked against the index and reindexed where it changed. Catches what
  // launch, focus, system resume or a missed watcher event never told the index about.
  async function reconcileAll(root: string, index: SessionIndex) {
    const { pass, ensureHydrated } = indexedWindowFor(index)
    await ensureHydrated()
    return reconcileCandidates(pass, await listingAt(root))
  }

  return { backfillTick, reconcileAll }
}
