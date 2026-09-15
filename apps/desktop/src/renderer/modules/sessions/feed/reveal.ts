import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react'
import type { SessionFeedRow } from '../types'
import type { Settled } from './use-settled-feed'

// New agent text is uncovered top to bottom while the virtualizer corrects the mounted row's
// height. The estimate controls only animation timing; layout is always measured from the row.
const REVEAL_PIXELS_PER_SECOND = 900
const REVEAL_MIN_MS = 250
const REVEAL_MAX_MS = 1200
// The soft lower edge of the uncovered text, so lines fade in rather than appear at a cut.
const REVEAL_EDGE_PX = 24
// The mask's own colour is achromatic: only its alpha selects what's revealed, independent of
// the appearance, so it stays a CSS keyword rather than an app colour token.
const REVEAL_MASK = `linear-gradient(to bottom, black calc(100% - ${REVEAL_EDGE_PX}px), transparent)`

export type Reveal = { fromPx: number; toPx: number; durationMs: number }

// What this deck last drew: the geometry it was drawn at, and each row's text, height and the
// reveal still playing on it, with the time that reveal ends.
type ShownRow = { text: string; height: number; playing?: { reveal: Reveal; endsAt: number } }
export type Shown = { rows: Map<string, ShownRow> }

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

function estimatedTextHeight(text: string) {
  return Math.max(REVEAL_EDGE_PX, Math.ceil(text.length / 48) * 24)
}

// A reveal still playing when an unrelated row arrives is handed on unchanged, so it plays to its
// end; new text is uncovered from the height the row was already shown at.
function playing(before: ShownRow | undefined, current: ShownRow, now: number) {
  if (before?.text === current.text) {
    return before.playing !== undefined && before.playing.endsAt > now ? before.playing : undefined
  }
  const fromPx = before === undefined ? 0 : Math.min(before.height, current.height)
  if (current.height <= fromPx) return undefined
  const next = reveal(fromPx, current.height)
  return { reveal: next, endsAt: now + next.durationMs }
}

// The first document a deck draws is history and shows at once, and so is any document drawn at
// a new width, font or zoom, where every height changed without any text arriving.
export function nextReveals(previous: Shown | null, settled: Settled, now: number) {
  const shown: Shown = { rows: new Map() }
  const reveals = new Map<string, Reveal>()
  for (const row of settled.rows) {
    if (!revealsText(row)) continue
    const current: ShownRow = { text: row.text, height: estimatedTextHeight(row.text) }
    shown.rows.set(row.id, current)
    if (previous === null) continue
    current.playing = playing(previous.rows.get(row.id), current, now)
    if (current.playing !== undefined) reveals.set(row.id, current.playing.reveal)
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
    const next = nextReveals(shown.current, settled, performance.now())
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
