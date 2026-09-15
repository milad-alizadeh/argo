import { type KeyboardEvent, useEffect, useRef } from 'react'

function cyclePickerFocus(event: KeyboardEvent<HTMLDivElement>, picker: HTMLDivElement | null) {
  if (event.key !== 'Tab') return
  const controls = picker?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled])',
  )
  if (!controls || controls.length === 0) return
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useContextPickerFocus(onClose: () => void) {
  const pickerRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => pickerRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
    [],
  )
  return {
    pickerRef,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      cyclePickerFocus(event, pickerRef.current)
    },
  }
}
