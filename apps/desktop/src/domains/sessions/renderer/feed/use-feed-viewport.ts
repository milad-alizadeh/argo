import { useCallback, useState } from 'react'

export function useFeedViewport() {
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [padding, setPadding] = useState({ start: 0, end: 0 })
  const attachViewport = useCallback((element: HTMLElement | null) => {
    if (element !== null) {
      const style = getComputedStyle(element)
      setPadding({
        start: Number.parseFloat(style.scrollPaddingTop) || 0,
        end: Number.parseFloat(style.scrollPaddingBottom) || 0,
      })
    }
    setViewport(element)
  }, [])
  return { attachViewport, padding, viewport }
}
