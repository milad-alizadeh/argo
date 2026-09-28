import { type RefObject, useLayoutEffect } from 'react'

export function useContextPickerPosition(
  anchorRef: RefObject<HTMLDivElement | null> | undefined,
  pickerRef: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const anchor = anchorRef?.current
    const picker = pickerRef.current
    if (!anchor || !picker) return
    const position = () => {
      const bounds = anchor.getBoundingClientRect()
      picker.style.left = `${bounds.left}px`
      picker.style.bottom = `${window.innerHeight - bounds.top}px`
      picker.style.width = `${bounds.width}px`
      picker.style.setProperty('--context-picker-space', `${Math.max(0, bounds.top)}px`)
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(anchor)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchorRef, pickerRef])
}
