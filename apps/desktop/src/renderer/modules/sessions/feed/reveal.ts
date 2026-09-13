import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react'
import type { SessionFeedRow } from '../types'
import type { Settled } from './useSettledFeed'

// New agent text is uncovered top to bottom inside the height ADR-0033 already gave its row, so
// nothing moves while it plays. The rate is a reading pace, capped so a long block never makes the
// reader wait.
const REVEAL_PIXELS_PER_SECOND = 900
const REVEAL_MIN_MS = 250
const REVEAL_MAX_MS = 1200
// The soft lower edge of the uncovered text, so lines fade in rather than appear at a cut.
const REVEAL_EDGE_PX = 24
const REVEAL_MASK = `linear-gradient(to bottom, #000 calc(100% - ${REVEAL_EDGE_PX}px), transparent)`

export type Reveal = { fromPx: number; toPx: number; durationMs: number }

// What this deck last drew: the geometry it was drawn at, and each row's text and height.
export type Shown = {
  geometry: string
  rows: Map<string, { text: string; height: number }>
}

function geometryOf(settled: Settled) {
  const { width, font, zoom } = settled.reading
  return JSON.stringify({ width, font, zoom })
}

function revealsText(row: SessionFeedRow): row is Extract<SessionFeedRow, { shape: 'prose' }> {
  return row.shape === 'prose' && row.role === 'assistant'
}

function reveal(fromPx: number, toPx: number): Reveal {
  const durationMs = ((toPx - fromPx) / REVEAL_PIXELS_PER_SECOND) * 1000
  return {
    fromPx,
    toPx,
    durationMs: Math.round(Math.min(REVEAL_MAX_MS, Math.max(REVEAL_MIN_MS, durationMs))),
  }
}

// The first document a deck draws is history and shows at once, and so is any document drawn at
// a new width, font or zoom, where every height changed without any text arriving.
export function nextReveals(previous: Shown | null, settled: Settled) {
  const geometry = geometryOf(settled)
  const shown: Shown = { geometry, rows: new Map() }
  const reveals = new Map<string, Reveal>()
  for (const row of settled.rows) {
    if (!revealsText(row)) continue
    const height = settled.heights.get(row.id) ?? 0
    shown.rows.set(row.id, { text: row.text, height })
    if (previous === null || previous.geometry !== geometry) continue
    const before = previous.rows.get(row.id)
    if (before?.text === row.text) continue
    const fromPx = before === undefined ? 0 : Math.min(before.height, height)
    if (height > fromPx) reveals.set(row.id, reveal(fromPx, height))
  }
  return { shown, reveals }
}

// One answer per settled document, so a render repeated for the same document (Strict Mode, a
// kept deck shown again) replays nothing.
export function useReveals() {
  const shown = useRef<Shown | null>(null)
  const computed = useRef(new WeakMap<Settled, ReadonlyMap<string, Reveal>>())
  return useCallback((settled: Settled) => {
    const held = computed.current.get(settled)
    if (held !== undefined) return held
    const next = nextReveals(shown.current, settled)
    shown.current = next.shown
    computed.current.set(settled, next.reveals)
    return next.reveals
  }, [])
}

// Runs before paint, so a row that arrives covered is never drawn uncovered for a frame. The mask
// lives only on the animation, and the row carries none once it ends.
export function useRevealAnimation(row: RefObject<HTMLElement | null>, reveal?: Reveal) {
  const fromPx = reveal?.fromPx
  const toPx = reveal?.toPx
  const durationMs = reveal?.durationMs
  useLayoutEffect(() => {
    const element = row.current
    if (element === null || fromPx === undefined || toPx === undefined) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const frame = { maskImage: REVEAL_MASK, maskRepeat: 'no-repeat' }
    const animation = element.animate(
      [
        { ...frame, maskSize: `100% ${fromPx}px` },
        { ...frame, maskSize: `100% ${toPx + REVEAL_EDGE_PX}px` },
      ],
      { duration: durationMs, easing: 'linear' },
    )
    return () => animation.cancel()
  }, [row, fromPx, toPx, durationMs])
}
