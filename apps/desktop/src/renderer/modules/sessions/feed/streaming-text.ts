import { useEffect, useRef, useState } from 'react'

const WORDS_PER_SECOND = 8
const MAX_LAG_SECONDS = 0.8

function wordEnds(text: string) {
  return [...text.matchAll(/\S+\s*/g)].map((match) => (match.index ?? 0) + match[0].length)
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The visible text stays in this row rather than the Session: it is a reading aid, not a fact
// about the Message (CONTEXT.md L3 · Message).
export function useStreamingText(text: string, streaming: boolean) {
  const [visibleText, setVisibleText] = useState(streaming ? '' : text)
  const current = useRef(streaming ? '' : text)
  const progress = useRef(streaming ? 0 : wordEnds(text).length)
  const prefersReducedMotion = reducedMotion()

  useEffect(() => {
    if (!streaming || prefersReducedMotion) {
      current.current = text
      progress.current = wordEnds(text).length
      setVisibleText(text)
      return
    }
    const ends = wordEnds(text)
    const previous = current.current
    if (!text.startsWith(previous)) {
      current.current = text
      progress.current = ends.length
      setVisibleText(text)
      return
    }
    const wordsPerSecond = Math.max(
      WORDS_PER_SECOND,
      (ends.length - progress.current) / MAX_LAG_SECONDS,
    )
    let previousFrame = performance.now()
    let frame: number | null = null
    const draw = (now: number) => {
      const remaining = ends.length - progress.current
      if (remaining <= 0) return
      const seconds = (now - previousFrame) / 1000
      previousFrame = now
      progress.current = Math.min(ends.length, progress.current + seconds * wordsPerSecond)
      const nextWords = Math.floor(progress.current)
      if (nextWords > wordEnds(current.current).length) {
        const next = text.slice(0, ends[nextWords - 1])
        current.current = next
        setVisibleText(next)
      }
      if (progress.current < ends.length) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [prefersReducedMotion, streaming, text])

  return !streaming || prefersReducedMotion ? text : visibleText
}
