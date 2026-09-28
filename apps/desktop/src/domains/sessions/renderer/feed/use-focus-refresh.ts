import { useEffect } from 'react'

// Focusing the window or showing it again refreshes the open Feed, once for a burst of both.
export function useFocusRefresh(refresh: (() => void) | null) {
  useEffect(() => {
    if (refresh === null) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(refresh, 250)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    window.addEventListener('focus', schedule)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      if (timer !== null) clearTimeout(timer)
      window.removeEventListener('focus', schedule)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])
}
