// Driving every adapter's background indexing from one window (#2373): a backfill scheduler per
// adapter, and reconcile riding the same tree-watch, focus and system-resume signals the roster's
// own change announcements already use. Both pause while a selected Feed is reading, so neither
// races the file it is reading. Split from `session-bridges.ts` to keep that composition root short.
import type { BrowserWindow } from 'electron'
import type { WatchedSource } from '../../../platform/main/watch/watch-source'
import type { SessionReader } from './bridge'
import { createBackfillScheduler } from './session-index/backfill-scheduler'
import type { SessionSource } from './session-source'

// One backfill batch at a time, per adapter that has an index to backfill into.
export function startBackfill(
  window: BrowserWindow,
  sources: readonly SessionSource[],
  reader: SessionReader,
) {
  const schedulers = sources.flatMap((source) => {
    if (source.backfillTick === undefined) return []
    const backfillTick = source.backfillTick
    const scheduler = createBackfillScheduler({
      tick: async () => backfillTick(),
      isPaused: () => reader.isFeedReadActive(),
    })
    scheduler.start()
    return [scheduler]
  })
  window.on('closed', () => {
    for (const scheduler of schedulers) scheduler.stop()
  })
}

// Every adapter's whole tree, checked against the index and reindexed where it changed. Catches
// what launch, focus, system resume or a missed watcher event never told the index about.
export function reconcileSessions(sources: readonly SessionSource[], reader: SessionReader) {
  if (reader.isFeedReadActive()) return
  for (const source of sources) {
    source.reconcileAll?.().catch((error) => console.error('Session reconcile failed', error))
  }
}

export function withReconcile(
  source: WatchedSource,
  sources: readonly SessionSource[],
  reader: SessionReader,
): WatchedSource {
  return (onChanged) =>
    source(() => {
      onChanged()
      reconcileSessions(sources, reader)
    })
}
