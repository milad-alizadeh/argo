import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { SessionFeedRow } from '../types'
import type { createHeightStore, Reading } from './heights'
import { readRowHeights, settleReading } from './measure'
import { afterAnimations, watchMeasured } from './relayout-watch'
import type { Settled } from './useSettledFeed'

type HeightStore = ReturnType<typeof createHeightStore>

// A relayout costs nothing to measure and nothing to wait for, so both numbers say so.
export function settledFrom(
  reading: Reading,
  rows: readonly SessionFeedRow[],
  rowHeights: Map<string, number>,
): Settled {
  return { reading, rows, heights: rowHeights, measuredMs: 0, settledMs: 0 }
}

type RelayoutInputs = {
  container: HTMLElement
  column: HTMLElement | null
  reading: Reading
  rows: readonly SessionFeedRow[]
  heights: HeightStore
  generation: RefObject<number>
  setSettled: Dispatch<SetStateAction<Settled | null>>
}

function sameHeights(left: Map<string, number>, right: Map<string, number>) {
  if (left.size !== right.size) return false
  for (const [id, height] of left) if (right.get(id) !== height) return false
  return true
}

// A closing disclosure holds its panel at its expanded size for the length of its close animation
// (`useCollapsiblePanel.js`'s close branch), so the first read is the true current size. The size
// after the animation is read once every animation under `column` (drawn rows and measured copies)
// has finished, and again on any later change to the measured copy. `generation` suffixes each
// later reading's key, which `AnchoredFeed` would otherwise treat as the same document and ignore.
export function settleRelayout({
  container,
  column,
  reading,
  rows,
  heights,
  generation,
  setSettled,
}: RelayoutInputs) {
  let committed = readRowHeights(container)
  heights.write(reading, committed)
  setSettled(settledFrom(reading, rows, committed))
  if (column === null) return undefined
  const reread = () => {
    const next = readRowHeights(container)
    if (sameHeights(next, committed)) return
    committed = next
    generation.current += 1
    const settledReading: Reading = {
      ...reading,
      revision: `${reading.revision}#${generation.current}`,
    }
    heights.write(settledReading, next)
    setSettled(settledFrom(settledReading, rows, next))
  }
  let stopWatching = () => {}
  const stopWaiting = afterAnimations(column, () => {
    reread()
    stopWatching = watchMeasured(container, reread)
  })
  return () => {
    stopWaiting()
    stopWatching()
  }
}

type SettlePassInputs = {
  container: HTMLElement
  column: HTMLElement | null
  reading: Reading
  rows: readonly SessionFeedRow[]
  heights: HeightStore
  sessionId: string
  contentRevision: string
  settledContent: RefObject<{ sessionId: string; contentRevision: string } | null>
  generation: RefObject<number>
  isActive: () => boolean
  setSettled: Dispatch<SetStateAction<Settled | null>>
}

// Dispatches a reading to whichever pass it needs: a cached one needs none, an unchanged
// (sessionId, contentRevision) pair is a relayout, and anything else is a live update.
export function runSettlePass({
  container,
  column,
  reading,
  rows,
  heights,
  sessionId,
  contentRevision,
  settledContent,
  generation,
  isActive,
  setSettled,
}: SettlePassInputs) {
  const cached = heights.read(reading)
  if (cached !== null) {
    settledContent.current = { sessionId, contentRevision }
    setSettled(settledFrom(reading, rows, cached))
    return undefined
  }
  const isRelayout =
    settledContent.current?.sessionId === sessionId &&
    settledContent.current.contentRevision === contentRevision
  settledContent.current = { sessionId, contentRevision }
  if (isRelayout) {
    return settleRelayout({ container, column, reading, rows, heights, generation, setSettled })
  }
  return settleLiveUpdate({ container, reading, rows, heights, sessionId, isActive, setSettled })
}

type LiveUpdateInputs = {
  container: HTMLElement
  reading: Reading
  rows: readonly SessionFeedRow[]
  heights: HeightStore
  sessionId: string
  isActive: () => boolean
  setSettled: Dispatch<SetStateAction<Settled | null>>
}

// A live update leaves the previously settled document in place until the new one is ready. A
// different Session has no shared rows, so it returns to the standing state instead.
export function settleLiveUpdate({
  container,
  reading,
  rows,
  heights,
  sessionId,
  isActive,
  setSettled,
}: LiveUpdateInputs) {
  setSettled((previous) => (previous?.reading.sessionId === sessionId ? previous : null))
  let live = true
  void settleReading(container, () => live && isActive()).then((pass) => {
    if (!live || pass === null) return
    heights.write(reading, pass.heights)
    setSettled({ reading, rows, ...pass })
  })
  return () => {
    live = false
  }
}
