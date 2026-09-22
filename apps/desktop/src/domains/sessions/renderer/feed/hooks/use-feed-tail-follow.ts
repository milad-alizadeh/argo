import type { Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useRef, useState } from 'react'
import { useDisclosureHold } from './use-disclosure-hold'

const TAIL_THRESHOLD_PX = 80

export function useFeedTailFollow(
  sessionId: string,
  { active, viewport }: { active: boolean; viewport: HTMLElement | null },
) {
  const [atLatest, setAtLatest] = useState(true)
  const [initiallyPositionedSessionId, setInitiallyPositionedSessionId] = useState<string | null>(
    null,
  )
  const latest = useRef<Virtualizer<HTMLElement, Element> | null>(null)
  const awaitingInitialPosition = initiallyPositionedSessionId !== sessionId
  const markInitiallyPositioned = useCallback(() => {
    setAtLatest(true)
    setInitiallyPositionedSessionId(sessionId)
  }, [sessionId])
  const onChange = useCallback(
    (instance: Virtualizer<HTMLElement, Element>) => {
      latest.current = instance
      // An inactive document measures 0x0, which reads as "at the end" and would lose the reader.
      if (awaitingInitialPosition || !active) return
      setAtLatest((current) => {
        const next = instance.isAtEnd(TAIL_THRESHOLD_PX)
        return current === next ? current : next
      })
    },
    [active, awaitingInitialPosition],
  )
  const holding = useDisclosureHold(viewport, () => {
    if (latest.current !== null) onChange(latest.current)
  })
  return {
    atLatest,
    awaitingInitialPosition,
    markInitiallyPositioned,
    onChange,
    shouldFollow: !holding && (awaitingInitialPosition || atLatest),
  }
}
