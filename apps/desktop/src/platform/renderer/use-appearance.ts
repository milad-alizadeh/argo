import { useSyncExternalStore } from 'react'
import {
  type AppearanceState,
  appearanceStateSchema,
  themeKey,
} from '@/platform/contract/appearance'

let accepted: AppearanceState
let readinessRequested = false
let acknowledgement: Promise<void> | undefined
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function applyAppearance(state: AppearanceState): void {
  const next = appearanceStateSchema.parse(state)
  if (accepted && next.revision < accepted.revision) return
  accepted = next
  const root = document.documentElement
  root.dataset.theme = next.theme
  root.classList.toggle('dark', next.dark)
  root.style.colorScheme = next.dark ? 'dark' : 'light'
  for (const listener of listeners) listener()
}

export async function initializeRendererAppearance(): Promise<void> {
  window.argo.onAppearanceChanged((state) => {
    applyAppearance(state)
    if (readinessRequested) {
      void (acknowledgement ?? Promise.resolve()).then(acknowledgeRendererAppearance)
    }
  })
  applyAppearance(await window.argo.getAppearance())
}

async function acknowledgeCurrentAppearance(): Promise<void> {
  for (;;) {
    const result = await window.argo.appearanceReady(accepted.revision)
    applyAppearance(result.state)
    if (result.ready && result.state.revision === accepted.revision) return
  }
}

export function acknowledgeRendererAppearance(): Promise<void> {
  readinessRequested = true
  acknowledgement ??= acknowledgeCurrentAppearance().finally(() => {
    acknowledgement = undefined
  })
  return acknowledgement
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => accepted)
}

export function useThemeKey() {
  return themeKey(useTheme())
}

export function useDarkAppearance() {
  return useSyncExternalStore(subscribe, () => accepted.dark)
}
