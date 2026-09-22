import { useLayoutEffect } from 'react'

export function useScrollPositionSnapshot(
  sessionId: string,
  viewport: HTMLElement | null,
  onPositionChange: (sessionId: string, position: number) => void,
) {
  useLayoutEffect(() => {
    if (viewport === null) return
    const rememberPosition = () => onPositionChange(sessionId, viewport.scrollTop)
    viewport.addEventListener('scroll', rememberPosition, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', rememberPosition)
      rememberPosition()
    }
  }, [onPositionChange, sessionId, viewport])
}
