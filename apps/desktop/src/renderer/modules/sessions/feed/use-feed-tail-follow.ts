import type { Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useRef, useState } from 'react'
import { useDisclosureHold } from './use-disclosure-hold'

const TAIL_THRESHOLD_PX = 80

export function useFeedTailFollow(sessionId: string, viewport: HTMLElement | null) {
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
      if (awaitingInitialPosition) return
      setAtLatest((current) => {
        const next = instance.isAtEnd(TAIL_THRESHOLD_PX)
        return current === next ? current : next
      })
    },
    [awaitingInitialPosition],
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
