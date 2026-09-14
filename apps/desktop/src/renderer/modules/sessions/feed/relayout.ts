import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { SessionFeedRow } from '../types'
import type { createHeightStore, Reading } from './heights'
import { readRowHeights, settleReading } from './measure'
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

// A closing disclosure holds its panel at its expanded pixel size for the length of its own close
// animation (Base UI measures before it plays the animation out, so the box the reader sees never
// shrinks under still-visible content — `useCollapsiblePanel.js`'s close branch), so reading heights
// on the spot is the true current size, not a stale one. What it can't report is the size *after*
// that animation ends, so a second read follows once it genuinely finishes, off the real animations
// `getAnimations()` finds on the drawn row — never off the hidden measured copy, whose own close
// animation never runs under `content-visibility: hidden` (Chromium skips animations on subtrees it
// isn't rendering), so `useAnimationsFinished.js` sees no animation there and its panel collapses on
// the very next frame regardless of how long the real one is still playing. `generation` suffixes
// that second reading's key, keeping it distinct from the first, which `AnchoredFeed` would
// otherwise treat as the same document and ignore.
export function settleRelayout({
  container,
  column,
  reading,
  rows,
  heights,
  generation,
  setSettled,
}: RelayoutInputs) {
  const relaidHeights = readRowHeights(container)
  heights.write(reading, relaidHeights)
  setSettled(settledFrom(reading, rows, relaidHeights))
  if (column === null) return undefined
  let live = true
  let started = false
  // A close animation is a CSS transition born from a style change this same commit made, and
  // the browser can register it a frame or more after that commit — Base UI documents the exact
  // same race in its own `useAnimationsFinished` caller (base-ui#3099). Guessing a frame count to
  // wait was unreliable across environments (it passed locally but not in every CI browser), so
  // this waits for the browser's own start signal instead: `transitionrun` (and `animationstart`
  // for a keyframe-driven variant) fires the instant the animation is actually registered.
  const handleStart = () => {
    if (started) return
    started = true
    column.removeEventListener('transitionrun', handleStart)
    column.removeEventListener('animationstart', handleStart)
    // `column` carries the drawn rows as well as their hidden measured copies, so an animation
    // still playing on either is caught. Nothing is running for an open, whose panel is already
    // at its final size, or for a resize settling, which plays no animation at all.
    const animations = column.getAnimations({ subtree: true })
    if (animations.length === 0) return
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!live) return
      generation.current += 1
      const settledReading: Reading = {
        ...reading,
        revision: `${reading.revision}#${generation.current}`,
      }
      const settledHeights = readRowHeights(container)
      heights.write(settledReading, settledHeights)
      setSettled(settledFrom(settledReading, rows, settledHeights))
    })
  }
  column.addEventListener('transitionrun', handleStart)
  column.addEventListener('animationstart', handleStart)
  return () => {
    live = false
    column.removeEventListener('transitionrun', handleStart)
    column.removeEventListener('animationstart', handleStart)
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
