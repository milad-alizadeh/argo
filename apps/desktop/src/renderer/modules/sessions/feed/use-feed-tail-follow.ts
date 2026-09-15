import type { Virtualizer } from '@tanstack/virtual-core'
import { useCallback, useState } from 'react'

const TAIL_THRESHOLD_PX = 80

export function useFeedTailFollow(sessionId: string) {
  const [atLatest, setAtLatest] = useState(true)
  const [initiallyPositionedSessionId, setInitiallyPositionedSessionId] = useState<string | null>(
    null,
  )
  const awaitingInitialPosition = initiallyPositionedSessionId !== sessionId
  const markInitiallyPositioned = useCallback(() => {
    setAtLatest(true)
    setInitiallyPositionedSessionId(sessionId)
  }, [sessionId])
  const onChange = useCallback(
    (instance: Virtualizer<HTMLElement, Element>) => {
      if (awaitingInitialPosition) return
      setAtLatest((current) => {
        const next = instance.isAtEnd(TAIL_THRESHOLD_PX)
        return current === next ? current : next
      })
    },
    [awaitingInitialPosition],
  )
  return {
    atLatest,
    awaitingInitialPosition,
    markInitiallyPositioned,
    onChange,
    shouldFollow: awaitingInitialPosition || atLatest,
  }
}
