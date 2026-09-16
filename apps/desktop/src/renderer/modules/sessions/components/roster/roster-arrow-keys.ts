import type { KeyboardEvent } from 'react'

export function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-session-id]'),
  ]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current === -1) return
  event.preventDefault()
  const nextByKey = {
    ArrowDown: Math.min(current + 1, buttons.length - 1),
    ArrowUp: Math.max(current - 1, 0),
    End: buttons.length - 1,
    Home: 0,
  }
  buttons[nextByKey[event.key as keyof typeof nextByKey]]?.focus()
}
