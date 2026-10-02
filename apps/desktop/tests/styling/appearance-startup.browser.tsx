import { afterEach, expect, test, vi } from 'vitest'
import type { AppearanceState } from '@/platform/contract/appearance'
import { initializeRendererAppearance } from '@/platform/renderer/use-appearance'
import { resetAppearanceDocument } from './browser-fixture'

afterEach(resetAppearanceDocument)

test('a newer subscription snapshot survives an older initial read response', async () => {
  const previous = window.argo
  const older: AppearanceState = {
    theme: 'default',
    appearance: 'light',
    dark: false,
    revision: 0,
  }
  const newer: AppearanceState = {
    theme: 'catppuccin',
    appearance: 'dark',
    dark: true,
    revision: 1,
  }
  const acknowledge = vi.fn(async () => ({ ready: true, state: newer }))
  window.argo = {
    ...previous,
    onAppearanceChanged: (listener) => {
      listener(newer)
      return () => {}
    },
    getAppearance: async () => older,
    appearanceReady: acknowledge,
  }
  try {
    await initializeRendererAppearance()
    expect(document.documentElement.dataset.theme).toBe('catppuccin')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(acknowledge).not.toHaveBeenCalled()
  } finally {
    window.argo = previous
  }
})
