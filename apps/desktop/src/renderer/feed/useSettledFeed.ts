import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedRow } from '../../sessions/feed'
import { createHeightStore, digestOfRows, type Reading } from './heights'
import { containerReading, settleReading } from './measure'

// One store for the launch, shared by every deck. Heights stay for every Session opened this
// launch, so switching back to a Session already read runs no pass (ADR-0033 rule 4).
const heights = createHeightStore()

export type Settled = {
  reading: Reading
  heights: Map<string, number>
  measuredMs: number
  settledMs: number
}

// Rule 6: the Feed stays at its old width, clipped, for the length of a drag, and one pass runs
// at drag end. This is that "drag end" — a width that has stopped moving.
const RESIZE_SETTLE_MS = 180

// The column is what a drag resizes, so it is what the observer watches. The width the pass keys
// on is read elsewhere, off the container the rows are actually laid out in.
function useSettledWidth(column: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const element = column.current
    if (element === null) return
    let timer: number | undefined
    const observer = new ResizeObserver(() => {
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
  }, [column])
  return width
}

// Nothing is drawn until this returns a reading. A cached one returns on the same tick, which is
// the kept-deck case; anything else runs one pass behind the activity indicator.
export function useSettledFeed(sessionId: string | null, rows: FeedRow[]) {
  const column = useRef<HTMLDivElement>(null)
  const measured = useRef<HTMLDivElement>(null)
  const [settled, setSettled] = useState<Settled | null>(null)
  const width = useSettledWidth(column)
  const rowsDigest = useMemo(() => digestOfRows(rows.map((row) => row.id)), [rows])

  useEffect(() => {
    const container = measured.current
    if (sessionId === null || container === null || width === null) return
    const reading: Reading = { sessionId, rowsDigest, ...containerReading(container) }
    const cached = heights.read(reading)
    if (cached !== null) {
      // Nothing was measured and nothing was waited for, and both numbers say so.
      setSettled({ reading, heights: cached, measuredMs: 0, settledMs: 0 })
      return
    }
    setSettled(null)
    let live = true
    void settleReading(container).then((pass) => {
      if (!live) return
      heights.write(reading, pass.heights)
      setSettled({ reading, ...pass })
    })
    return () => {
      live = false
    }
  }, [sessionId, rowsDigest, width])

  // The reading on hand is handed back only while it is a reading OF what is about to be drawn.
  // This effect is passive, so a render carrying a new Session — or the same Session grown by a
  // turn — commits before the pass for it has started, and the previous reading holds a height for
  // none of those rows.
  //
  // Measured: with the caller's own gate in place (App's `shown`, which keeps rows and the chosen
  // id travelling together) React flushes this effect before the next paint, so removing the line
  // below turns no frame of the packaged proof red on its own. It is this module's invariant
  // rather than the caller's — never hand back a reading of another document, whoever is asking —
  // and `no-unmeasured-row` samples the pair.
  const settledHere =
    settled !== null &&
    settled.reading.sessionId === sessionId &&
    settled.reading.rowsDigest === rowsDigest
      ? settled
      : null

  return { column, measured, settled: settledHere }
}
