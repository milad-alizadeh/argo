import { type RefObject, useLayoutEffect, useRef } from 'react'

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'

// The control marked `data-focus-rescue` inside `root`, or else the first control there.
export function firstControl(root: Element | null): HTMLElement | null {
  const marked = root?.querySelector<HTMLElement>('[data-focus-rescue]:not(:disabled)')
  return marked ?? root?.querySelector<HTMLElement>(FOCUSABLE) ?? null
}

// Focus on the body, or on a dialog around `root`, is focus that fell there when its control went.
const fallen = (active: Element | null, root: HTMLElement) =>
  !active || active === document.body || active.contains(root)

// A control that removes or disables itself drops focus outside the place the person was working.
// When `change` changes after focus was last held inside `container`, and focus has since fallen,
// it returns to `firstControl` there. Focus that was never inside is never taken.
export function useFocusRescue(container: RefObject<HTMLElement | null>, change: unknown) {
  const previous = useRef(change)
  const held = useRef(false)
  // Read before the commit, while a control about to be removed still holds focus.
  const root = container.current
  if (root && !fallen(document.activeElement, root)) {
    held.current = root.contains(document.activeElement)
  }
  useLayoutEffect(() => {
    if (Object.is(previous.current, change)) return
    previous.current = change
    const current = container.current
    if (current && held.current && fallen(document.activeElement, current)) {
      firstControl(current)?.focus()
    }
  })
}
