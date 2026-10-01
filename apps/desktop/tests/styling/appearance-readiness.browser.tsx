import { afterEach, expect, test, vi } from 'vitest'
import type { AppearanceState } from '@/platform/contract/appearance'
import nativeThemeBackgrounds from '@/platform/contract/native-theme-backgrounds.json'
import { acknowledgeRendererAppearance, applyAppearance } from '@/platform/renderer/use-appearance'
import { drawnColor, resetAppearanceDocument } from './browser-fixture'

afterEach(resetAppearanceDocument)

test('stale readiness retries only after applying the latest snapshot to DOM and CSS', async () => {
  const previous = window.argo
  const stale: AppearanceState = {
    theme: 'neutral',
    appearance: 'light',
    dark: false,
    revision: 0,
  }
  const current: AppearanceState = {
    theme: 'graphite',
    appearance: 'system',
    dark: true,
    revision: 1,
  }
  applyAppearance(stale)
  const acknowledge = vi.fn(async (revision: number) => {
    const ready = revision === current.revision
    if (ready) {
      expect(document.documentElement.dataset.theme).toBe(current.theme)
      expect(document.documentElement.style.colorScheme).toBe('dark')
      expect(
        drawnColor(getComputedStyle(document.documentElement).getPropertyValue('--background')),
      ).toEqual(drawnColor(nativeThemeBackgrounds.graphite.dark))
    }
    return { ready, state: current }
  })
  window.argo = { ...previous, appearanceReady: acknowledge }
  try {
    await acknowledgeRendererAppearance()
    expect(acknowledge.mock.calls.map(([revision]) => revision)).toEqual([0, 1])
  } finally {
    window.argo = previous
  }
})
