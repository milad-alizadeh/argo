import { type MutableRefObject, type RefObject, useEffect, useRef, useState } from 'react'

import type { SessionFeedRow } from '../types'
import { createHeightStore, type Reading } from './heights'
import { containerReading, settleReading } from './measure'

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

type SettledFeedOptions = {
  active: boolean
  sessionId: string | null
  revision: string | null
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
// the kept-deck case; anything else runs one pass behind the activity indicator.
export function useSettledFeed({ active, sessionId, revision, rows }: SettledFeedOptions) {
  const column = useRef<HTMLDivElement>(null)
  const measured = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active
  const [settled, setSettled] = useState<Settled | null>(null)
  const width = useSettledWidth(active, activeRef, column)
  const geometry = useGeometry(active, activeRef, measured)

  useEffect(() => {
    const container = measured.current
    if (
      !active ||
      sessionId === null ||
      revision === null ||
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
      // Nothing was measured and nothing was waited for, and both numbers say so.
      setSettled({ reading, rows, heights: cached, measuredMs: 0, settledMs: 0 })
      return
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
  }, [active, sessionId, revision, rows, width, geometry])

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
