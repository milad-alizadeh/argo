import { useEffect, useRef, useState } from 'react'

// A reading pace, not a typing one, and a ceiling on how long a burst can trail before the
// reveal rate lifts to close the gap.
const WORDS_PER_SECOND = 8
const MAX_LAG_SECONDS = 0.8

function wordEnds(text: string) {
  return [...text.matchAll(/\S+\s*/g)].map((match) => (match.index ?? 0) + match[0].length)
}

// `progress` counts whole words revealed of `text`.
export type RevealState = { text: string; progress: number }

// Keyed by row id, and owned by the Feed document rather than the row: the virtualizer unmounts
// a row once it scrolls past the overscan window, and the reveal must resume from here rather
// than restart from empty when the reader scrolls back (#2100).
export type RevealCache = Map<string, RevealState>

// `target` is the latest known text; `shown` is what was last drawn, and at what `progress`. A
// `target` that no longer extends `shown.text` (an edit, not an append) snaps rather than
// replays, since there is no shared prefix left to walk from.
export function advanceVisibleText(
  shown: RevealState,
  target: string,
  elapsedSeconds: number,
): RevealState {
  const ends = wordEnds(target)
  if (!target.startsWith(shown.text)) return { text: target, progress: ends.length }
  const wordsPerSecond = Math.max(
    WORDS_PER_SECOND,
    (ends.length - shown.progress) / MAX_LAG_SECONDS,
  )
  const progress = Math.min(ends.length, shown.progress + elapsedSeconds * wordsPerSecond)
  const words = Math.floor(progress)
  const text = words === 0 ? '' : target.slice(0, ends[words - 1])
  return { text, progress }
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function initialReveal(text: string, streaming: boolean): RevealState {
  return streaming ? { text: '', progress: 0 } : { text, progress: wordEnds(text).length }
}

// The visible text is a reading aid, not a fact about the Message (CONTEXT.md L3 · Message), but
// it survives this row's own remounts through `cache`, keyed by `rowId`.
export function useStreamingText(
  text: string,
  streaming: boolean,
  rowId: string,
  cache: RevealCache,
) {
  const [visibleText, setVisibleText] = useState(
    () => (cache.get(rowId) ?? initialReveal(text, streaming)).text,
  )
  const shown = useRef(cache.get(rowId) ?? initialReveal(text, streaming))
  const prefersReducedMotion = reducedMotion()

  useEffect(() => {
    if (!streaming || prefersReducedMotion) {
      const settled = { text, progress: wordEnds(text).length }
      shown.current = settled
      cache.set(rowId, settled)
      setVisibleText(text)
      return
    }
    let previousFrame = performance.now()
    let frame: number | null = null
    const draw = (now: number) => {
      const elapsedSeconds = (now - previousFrame) / 1000
      previousFrame = now
      const next = advanceVisibleText(shown.current, text, elapsedSeconds)
      if (next.text !== shown.current.text) setVisibleText(next.text)
      shown.current = next
      cache.set(rowId, next)
      if (next.progress < wordEnds(text).length) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [prefersReducedMotion, streaming, text, rowId, cache])

  return !streaming || prefersReducedMotion ? text : visibleText
}
