import { useLayoutEffect } from 'react'

export function useScrollPositionSnapshot(
  sessionId: string,
  viewport: HTMLElement | null,
  onPositionChange: (sessionId: string, position: number) => void,
) {
  useLayoutEffect(
    () => () => {
      if (viewport !== null) onPositionChange(sessionId, viewport.scrollTop)
    },
    [onPositionChange, sessionId, viewport],
  )
}
