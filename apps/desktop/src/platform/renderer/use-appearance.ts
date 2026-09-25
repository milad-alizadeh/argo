// The renderer holds no appearance state of its own: it shows what the main process resolved, and
// asks the main process to change it (src/appearance/bridge.ts).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  type Appearance,
  type AppearanceState,
  DEFAULT_APPEARANCE,
} from '@/platform/contract/appearance'

const INITIAL: AppearanceState = { appearance: DEFAULT_APPEARANCE, dark: true }

function subscribeToAppearance(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function isDarkAppearance() {
  return document.documentElement.classList.contains('dark')
}

export function useDarkAppearance() {
  return useSyncExternalStore(subscribeToAppearance, isDarkAppearance)
}

export function useAppearance(): [Appearance, (chosen: Appearance) => void] {
  const [state, setState] = useState<AppearanceState>(INITIAL)

  useEffect(() => {
    const bridge = window.argo as typeof window.argo & {
      getAppearance?: () => Promise<AppearanceState>
    }
    if (bridge.getAppearance === undefined) return
    void bridge.getAppearance().then(setState)
    return bridge.onAppearanceChanged(setState)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.dark)
    // Scrollbars and native form controls read this, not the class.
    document.documentElement.style.colorScheme = state.dark ? 'dark' : 'light'
  }, [state.dark])

  const choose = useCallback((chosen: Appearance) => {
    const bridge = window.argo as typeof window.argo & {
      setAppearance?: (appearance: Appearance) => Promise<AppearanceState>
    }
    if (bridge.setAppearance === undefined) return
    void bridge.setAppearance(chosen).then(setState)
  }, [])

  return [state.appearance, choose]
}
