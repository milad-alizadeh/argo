// The renderer holds no appearance state of its own: it shows what the main process resolved, and
// asks the main process to change it (src/appearance/bridge.ts).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  type Appearance,
  type AppearanceState,
  DEFAULT_APPEARANCE,
} from '@/platform/shared/appearance'

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
    void window.argo.getAppearance().then(setState)
    return window.argo.onAppearanceChanged(setState)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.dark)
    // Scrollbars and native form controls read this, not the class.
    document.documentElement.style.colorScheme = state.dark ? 'dark' : 'light'
  }, [state.dark])

  const choose = useCallback((chosen: Appearance) => {
    void window.argo.setAppearance(chosen).then(setState)
  }, [])

  return [state.appearance, choose]
}
