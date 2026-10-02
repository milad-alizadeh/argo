import { type RefObject, useLayoutEffect, useRef } from 'react'

export function useSidebarToggleFocus(
  toggleRef: RefObject<HTMLButtonElement | null>,
  collapsed: boolean,
) {
  const requestedState = useRef<boolean | null>(null)
  useLayoutEffect(() => {
    if (requestedState.current !== collapsed) return
    toggleRef.current?.focus()
    requestedState.current = null
  }, [collapsed, toggleRef])
  return () => {
    requestedState.current = toggleRef.current === document.activeElement ? !collapsed : null
  }
}
