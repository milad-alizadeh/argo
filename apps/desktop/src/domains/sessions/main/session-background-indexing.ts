// Driving every adapter's background indexing from one window (#2373): a backfill scheduler per
// adapter, and reconcile riding the same tree-watch, focus and system-resume signals the roster's
// own change announcements already use. Both pause while a selected Feed is reading, so neither
// races the file it is reading. Split from `session-bridges.ts` to keep that composition root short.
import type { BrowserWindow } from 'electron'
import type { SessionReader } from '@/domains/sessions/main/bridge'
import { createBackfillScheduler } from '@/domains/sessions/main/session-index/backfill-scheduler'
import type { BackfillProgress } from '@/domains/sessions/main/session-index/contract'
import type { SessionSource } from '@/domains/sessions/main/session-source'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

type IndexedBackfillSource = Pick<SessionSource, 'backfillTick' | 'reconcileAll'> & {
  backfillTick: NonNullable<SessionSource['backfillTick']>
}

export function createLaunchBackfillTick(source: IndexedBackfillSource) {
  let launchReconciled = false

  return async (): Promise<BackfillProgress> => {
    const progress = await source.backfillTick()
    if (!progress.complete || launchReconciled) return progress
    await source.reconcileAll?.()
    launchReconciled = true
    return progress
  }
}

// One backfill batch at a time, per adapter that has an index to backfill into.
export function startBackfill(
  window: BrowserWindow,
  sources: readonly SessionSource[],
  reader: SessionReader,
) {
  const schedulers = sources.flatMap((source) => {
    const backfillTick = source.backfillTick
    if (backfillTick === undefined) return []
    const tick = createLaunchBackfillTick({ ...source, backfillTick })
    const scheduler = createBackfillScheduler({
      tick,
      isPaused: () => reader.isFeedReadActive(),
      completedRetryMs: 30_000,
      onError: (error) => console.error('Session backfill failed', error),
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
export async function reconcileIndexedSources(
  sources: readonly Pick<SessionSource, 'historyComplete' | 'reconcileAll'>[],
) {
  await Promise.all(
    sources.map(async (source) => {
      if (source.historyComplete === undefined || source.reconcileAll === undefined) return
      if (await source.historyComplete()) await source.reconcileAll()
    }),
  )
}

export function reconcileSessions(sources: readonly SessionSource[], reader: SessionReader) {
  if (reader.isFeedReadActive()) return
  reconcileIndexedSources(sources).catch((error) =>
    console.error('Session reconcile failed', error),
  )
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
