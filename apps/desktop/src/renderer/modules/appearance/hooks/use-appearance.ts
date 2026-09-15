// The renderer holds no appearance state of its own: it shows what the main process resolved, and
// asks the main process to change it (src/appearance/bridge.ts).
import { useCallback, useEffect, useState } from 'react'
import {
  type Appearance,
  type AppearanceState,
  DEFAULT_APPEARANCE,
} from '@/core/appearance/appearance'

const INITIAL: AppearanceState = { appearance: DEFAULT_APPEARANCE, dark: true }

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
