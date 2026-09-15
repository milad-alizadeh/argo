import { useEffect, useState } from 'react'

// How long an attached card takes to open and to collapse; `AttachmentTray` hands both to CSS.
export const ATTACHMENT_ENTER_MS = 320
export const ATTACHMENT_EXIT_MS = 280

// Reduced motion draws no collapse, so a leaving card goes at once rather than sitting inert.
export function attachmentExitDelay(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ATTACHMENT_EXIT_MS
}

// Keeps the last value on screen while it collapses, so it leaves the tray the way it arrived.
export function useExitPresence<T>(value: T | null) {
  const [shown, setShown] = useState(value)
  if (value !== null && value !== shown) setShown(value)
  const exiting = value === null && shown !== null
  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => setShown(null), attachmentExitDelay())
    return () => window.clearTimeout(timer)
  }, [exiting])
  return { exiting, shown }
}

export function focusMessageField() {
  document.querySelector<HTMLElement>('[aria-label="Message"]')?.focus()
}

// A card leaving the tray hands focus to the next control in it, or else to the message field.
export function focusAfterLeaving(card: Element) {
  const tray = card.parentElement?.querySelectorAll<HTMLButtonElement>('button') ?? []
  const next = [...tray].find((control) => !card.contains(control))
  if (next === undefined) focusMessageField()
  else next.focus()
}
