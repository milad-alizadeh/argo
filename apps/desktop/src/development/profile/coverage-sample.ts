// One frame's reading of how well mounted rows cover a scrolling viewport. It runs inside the
// page, so it reaches nothing outside this file: `frame-recorder.ts` sends the source text.
//
// `blankPx` is what the main thread would paint empty this frame. `reachAbovePx` and
// `reachBelowPx` are how far unbroken rows extend past each edge: the compositor can scroll that
// far on its own before the reader sees an empty band. `null` means the list ends on that side.
import type { Coverage } from './frame-recorder'

export type CoverageReading = {
  scrollTop: number
  blankPx: number
  reachAbovePx: number | null
  reachBelowPx: number | null
}

// Row rects joined into the unbroken spans of screen they cover, top to bottom.
export function mergeRows(rows: Element[], visibleGapPx: number) {
  const merged: [number, number][] = []
  const rects = rows.map((row) => row.getBoundingClientRect()).sort((a, b) => a.top - b.top)
  for (const rect of rects) {
    const last = merged.at(-1)
    if (last && rect.top - last[1] <= visibleGapPx) last[1] = Math.max(last[1], rect.bottom)
    else merged.push([rect.top, rect.bottom])
  }
  return merged
}

export function sampleCoverage(coverage: Coverage): CoverageReading {
  // Under this, a gap between rows is subpixel rounding and not something a reader can see.
  const visibleGapPx = 2
  const viewport = document.querySelector(coverage.viewport)
  if (!viewport) return { scrollTop: 0, blankPx: 0, reachAbovePx: null, reachBelowPx: null }
  const box = viewport.getBoundingClientRect()
  const merged = mergeRows([...viewport.querySelectorAll(coverage.rows)], visibleGapPx)
  // Space above the first row and below the last is the list's own padding, not a blank.
  const first = viewport.querySelector(`${coverage.rows}[data-index="0"]`)
  const atStart = first !== null && first.getBoundingClientRect().bottom > box.top
  const atEnd =
    viewport.scrollTop + 2 * viewport.clientHeight >= viewport.scrollHeight - visibleGapPx
  const top = atStart ? Math.max(box.top, merged[0]?.[0] ?? box.top) : box.top
  const bottom = atEnd ? Math.min(box.bottom, merged.at(-1)?.[1] ?? box.bottom) : box.bottom
  let covered = 0
  for (const [start, end] of merged)
    covered += Math.max(0, Math.min(end, bottom) - Math.max(start, top))
  const around = (edge: number) =>
    merged.find(([start, end]) => start <= edge + visibleGapPx && end >= edge - visibleGapPx)
  const above = around(box.top)
  const below = around(box.bottom)
  return {
    scrollTop: viewport.scrollTop,
    blankPx: Math.round(Math.max(0, bottom - top - covered)),
    reachAbovePx: atStart ? null : Math.round(above ? box.top - above[0] : 0),
    reachBelowPx: atEnd ? null : Math.round(below ? below[1] - box.bottom : 0),
  }
}
