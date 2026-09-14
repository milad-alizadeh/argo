import {
  type MutableRefObject,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import type { SessionFeedRow } from '../types'
import { createHeightStore, type Reading } from './heights'
import { containerReading, readRowHeights, settleReading } from './measure'

// One store for the launch, shared by every deck. Heights stay for every Session opened this
// launch, so switching back to a Session already read runs no pass (ADR-0033 rule 4).
const heights = createHeightStore()

export type Settled = {
  reading: Reading
  rows: readonly SessionFeedRow[]
  heights: Map<string, number>
  measuredMs: number
  settledMs: number
}

// A relayout costs nothing to measure and nothing to wait for, so both numbers say so.
function settledFrom(
  reading: Reading,
  rows: readonly SessionFeedRow[],
  heights: Map<string, number>,
): Settled {
  return { reading, rows, heights, measuredMs: 0, settledMs: 0 }
}

type SettledFeedOptions = {
  active: boolean
  sessionId: string | null
  revision: string | null
  // The Session's own revision, apart from any layout-only state folded into `revision` (a
  // collapsible's open set, today). Unchanged from the last settle, it says no row's content
  // actually moved, so the pass can read heights on the same frame the toggle commits instead of
  // behind the warm-up rule 3 built for new content.
  contentRevision: string | null
  rows: readonly SessionFeedRow[]
}

// Rule 6: the Feed stays at its old width, clipped, for the length of a drag, and one pass runs
// at drag end. This is that "drag end" — a width that has stopped moving.
const RESIZE_SETTLE_MS = 180
const GEOMETRY_REFRESH_MS = 500

// The column is what a drag resizes, so it is what the observer watches. The width the pass keys
// on is read elsewhere, off the container the rows are actually laid out in.
function useSettledWidth(
  active: boolean,
  activeRef: MutableRefObject<boolean>,
  column: RefObject<HTMLElement | null>,
) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!active) return
    const element = column.current
    if (element === null) return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
      if (!activeRef.current) return
      window.clearTimeout(timer)
      timer = window.setTimeout(
        () => setWidth(element.getBoundingClientRect().width),
        RESIZE_SETTLE_MS,
      )
    })
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [active, activeRef, column])
  return width
}

// A font load or Electron zoom change can leave the CSS width alone while changing every prose
// height. Watch those other two invalidators only while this visible deck may read layout.
type Geometry = Pick<Reading, 'font' | 'zoom'>

function useGeometry(
  active: boolean,
  activeRef: MutableRefObject<boolean>,
  measured: RefObject<HTMLElement | null>,
) {
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  useEffect(() => {
    if (!active) {
      setGeometry(null)
      return
    }
    const container = measured.current
    if (container === null) return
    if (!activeRef.current) return
    let current = geometryOf(container)
    setGeometry(current)
    const reread = () => {
      if (!activeRef.current) return
      const next = geometryOf(container)
      if (geometryKey(next) === geometryKey(current)) return
      current = next
      setGeometry(next)
    }
    document.fonts.addEventListener('loadingdone', reread)
    const timer = window.setInterval(reread, GEOMETRY_REFRESH_MS)
    return () => {
      document.fonts.removeEventListener('loadingdone', reread)
      window.clearInterval(timer)
    }
  }, [active, activeRef, measured])
  return geometry
}

// Nothing is drawn until this returns a reading. A cached one returns on the same tick, which is
// the kept-deck case; anything else runs one pass behind the activity indicator, unless the
// reading's content hasn't moved, in which case there is nothing to await either.
export function useSettledFeed({
  active,
  sessionId,
  revision,
  contentRevision,
  rows,
}: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const measured = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [settled, setSettled] = useState<Settled | null>(null)
  const width = useSettledWidth(active, activeRef, column)
  const geometry = useGeometry(active, activeRef, measured)
  // The (Session, content) pair the last settled reading was drawn against, read and written in
  // the same layout effect the pass runs in. A relayout that leaves it unchanged — a collapsible's
  // own open set, or a column resize settling — moved no row's content, so it is read on the spot
  // instead of behind rule 3's warm-up.
  const settledContent = useRef<{ sessionId: string; contentRevision: string } | null>(null)
  // A closing disclosure holds its panel at its expanded pixel size for the length of its own
  // close animation (Base UI measures before it plays the animation out, so the box the reader
  // sees never shrinks under still-visible content — `useCollapsiblePanel.js`'s close branch),
  // so a relayout read while that animation is running is the true current size, not a stale one.
  // What it can't report is the size *after* that animation ends, so a second read follows once
  // it genuinely finishes, off the real animations `getAnimations()` finds on the drawn row —
  // never off the hidden measured copy, whose own close animation never runs under
  // `content-visibility: hidden` (Chromium skips animations on subtrees it isn't rendering), so
  // `useAnimationsFinished.js` sees no animation there and its panel collapses on the very next
  // frame regardless of how long the real one is still playing. The suffix keeps that second
  // reading's key distinct from the first, which `AnchoredFeed` would otherwise treat as the same
  // document and ignore.
  const relayoutGeneration = useRef(0)

  // A layout effect, not a passive one: a relayout is read back before the browser paints the
  // commit that triggered it, so a toggled disclosure never paints the frame in between, its panel
  // already at its open size while the row around it still carries the old, smaller height.
  useLayoutEffect(() => {
    const container = measured.current
    if (
      !active ||
      sessionId === null ||
      revision === null ||
      contentRevision === null ||
      container === null ||
      width === null ||
      geometry === null
    ) {
      return
    }
    const reading: Reading = {
      sessionId,
      revision,
      width: containerReading(container).width,
      ...geometry,
    }
    const cached = heights.read(reading)
    if (cached !== null) {
      settledContent.current = { sessionId, contentRevision }
      setSettled(settledFrom(reading, rows, cached))
      return
    }
    const isRelayout =
      settledContent.current?.sessionId === sessionId &&
      settledContent.current.contentRevision === contentRevision
    settledContent.current = { sessionId, contentRevision }
    if (isRelayout) {
      const relaidHeights = readRowHeights(container)
      heights.write(reading, relaidHeights)
      setSettled(settledFrom(reading, rows, relaidHeights))
      // `column` carries the drawn rows as well as their hidden measured copies, so an animation
      // still playing on either is caught. Nothing is running for an open, whose panel is already
      // at its final size, or for a resize settling, which plays no animation at all.
      const animations = column.current?.getAnimations({ subtree: true }) ?? []
      if (animations.length === 0) return
      let live = true
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (!live) return
        relayoutGeneration.current += 1
        const settledReading: Reading = {
          ...reading,
          revision: `${reading.revision}#${relayoutGeneration.current}`,
        }
        const settledHeights = readRowHeights(container)
        heights.write(settledReading, settledHeights)
        setSettled(settledFrom(settledReading, rows, settledHeights))
      })
      return () => {
        live = false
      }
    }
    // A live update leaves the previously settled document in place until the new one is ready.
    // A different Session has no shared rows, so it returns to the standing state instead.
    setSettled((previous) => (previous?.reading.sessionId === sessionId ? previous : null))
    let live = true
    void settleReading(container, () => live && activeRef.current).then((pass) => {
      if (!live || pass === null) return
      heights.write(reading, pass.heights)
      setSettled({ reading, rows, ...pass })
    })
    return () => {
      live = false
    }
  }, [active, sessionId, revision, contentRevision, rows, width, geometry])

  // Never hand back another Session's document. A newer revision of this Session is deliberately
  // allowed to keep the older settled document visible while its complete replacement measures.
  const settledHere = settled !== null && settled.reading.sessionId === sessionId ? settled : null

  return { column, measured, settled: settledHere }
}

function geometryOf(container: HTMLElement): Geometry {
  const reading = containerReading(container)
  return { font: reading.font, zoom: reading.zoom }
}

function geometryKey(geometry: Geometry) {
  return JSON.stringify(geometry)
}
