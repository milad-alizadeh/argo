import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react'

export function useSidebarToggleFocus(
  toggleRef: RefObject<HTMLButtonElement | null>,
  collapsed: boolean,
) {
  const requestedState = useRef<boolean | null>(null)
  useLayoutEffect(() => {
    if (requestedState.current !== collapsed) return
    let frame: number
    const focusWhenVisible = () => {
      const button = toggleRef.current
      if (button && getComputedStyle(button).visibility !== 'visible') {
        frame = requestAnimationFrame(focusWhenVisible)
        return
      }
      button?.focus()
      requestedState.current = null
    }
    frame = requestAnimationFrame(focusWhenVisible)
    return () => cancelAnimationFrame(frame)
  }, [collapsed, toggleRef])
  return useCallback(() => {
    requestedState.current = toggleRef.current === document.activeElement ? !collapsed : null
  }, [collapsed, toggleRef])
}
