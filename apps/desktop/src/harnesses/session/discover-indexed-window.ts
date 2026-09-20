// The indexed branch of transcript discovery (#2372, #2373): a bounded window read through the
// Session index, presented with the strongest known title and newest first, alongside how far
// background backfill has walked so a caller never mistakes a still-catching-up index for the
// machine's whole history. Split out of discover-transcript-sessions.ts to keep it under the file
// line ceiling.

import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { createIndexedWindow } from '@/domains/sessions/main/session-index/indexed-window'
import type { TranscriptDiscovery } from '@/harnesses/session/discover-transcript-sessions'
import { nextCursorFor } from '@/harnesses/session/discover-transcript-sessions'
import type { SessionIndex } from '@/harnesses/session/session-index-contract'
import type { createTitleLedger } from '@/harnesses/session/title-ledger'

// One indexed reader per index handed in, kept because it holds the hydration the first pass
// paid for. A different index rebinds it rather than reusing another database's history.
export function boundIndexedWindow(windowSource: Parameters<typeof createIndexedWindow>[0]) {
  let bound: { index: SessionIndex; read: ReturnType<typeof createIndexedWindow> } | null = null
  return function indexedWindowFor(index: SessionIndex) {
    if (bound?.index !== index) bound = { index, read: createIndexedWindow(windowSource, index) }
    return bound.read
  }
}

// The strongest title Argo has seen for a Session outranks whatever this pass read, and the
// Roster is newest first. Both apply to an indexed row exactly as they do to a freshly parsed
// one, so they share this one presentation step rather than living inside either read path.
export function presentedRows(
  strongestTitle: ReturnType<typeof createTitleLedger>,
  rows: SessionRosterRow[],
): SessionRosterRow[] {
  for (const row of rows) row.title = strongestTitle(row.id, row.title)
  return rows.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
}

export type DiscoverIndexedWindowOptions = {
  root: string
  windowSize: number
  index: SessionIndex
  harness: string
  indexedWindowFor: (index: SessionIndex) => ReturnType<typeof createIndexedWindow>
  presented: (rows: SessionRosterRow[]) => SessionRosterRow[]
}

export async function discoverIndexedWindow(
  options: DiscoverIndexedWindowOptions,
): Promise<TranscriptDiscovery> {
  const { root, windowSize, index, harness, indexedWindowFor, presented } = options
  const [window, progress] = await Promise.all([
    indexedWindowFor(index).readWindow(root, windowSize),
    index.backfillProgress(harness),
  ])
  return {
    ...window,
    rows: presented(window.rows),
    nextCursor: nextCursorFor(window.filesFound, windowSize),
    historyComplete: progress.complete,
  }
}
