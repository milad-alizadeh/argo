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

// The visible text stays in this row rather than the Session: it is a reading aid, not a fact
// about the Message (CONTEXT.md L3 · Message).
export function useStreamingText(text: string, streaming: boolean) {
  const [visibleText, setVisibleText] = useState(streaming ? '' : text)
  const shown = useRef({
    text: streaming ? '' : text,
    progress: streaming ? 0 : wordEnds(text).length,
  })
  const prefersReducedMotion = reducedMotion()

  useEffect(() => {
    if (!streaming || prefersReducedMotion) {
      shown.current = { text, progress: wordEnds(text).length }
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
      if (next.progress < wordEnds(text).length) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [prefersReducedMotion, streaming, text])

  return !streaming || prefersReducedMotion ? text : visibleText
}
