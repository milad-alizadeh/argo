import { useEffect, useRef } from 'react'
import type { RosterRow } from '@/domains/sessions/renderer/roster/roster-rows'

// A sentinel row scrolling into view is the trigger to fetch its page's continuation; the roster and
// the Archive each hold their own sentinel and fetch callback.
//
// The range is the virtualizer's visible range, never its mounted items: virtual-core applies the
// overscan after computing that range (`defaultRangeExtractor`), so a sentinel 30 rows below the fold
// is mounted and counted as reached. The roster then grew a page before the reader had scrolled at
// all, and kept growing a page per read while the sentinel sat in the overscan band.
//
// The effect depends on the two indices rather than on the range object or the item array: both are
// rebuilt on every render, so depending on either asked for the next page again each render for as
// long as the sentinel stayed on screen (#2277).
export function useSentinelFetch(options: {
  rows: readonly RosterRow[]
  kind: RosterRow['kind']
  range: { startIndex: number; endIndex: number } | null
  onFetch: () => void
}) {
  const { rows, kind, range, onFetch } = options
  const sentinelIndex = rows.findIndex((row) => row.kind === kind)
  const start = range?.startIndex ?? -1
  const end = range?.endIndex ?? -1
  const reached = sentinelIndex !== -1 && sentinelIndex >= start && sentinelIndex <= end
  // The callback is read through a ref rather than depended on: its identity changes on every render
  // of the sidebar, so depending on it asked for a page per render while the sentinel stayed in view.
  // The row count is a dependency, because a sentinel still visible after a page landed is a reader
  // who has scrolled past everything loaded and wants the next one.
  const latest = useRef(onFetch)
  latest.current = onFetch
  const loaded = rows.length
  useEffect(() => {
    if (reached && loaded > 0) latest.current()
  }, [reached, loaded])
}
