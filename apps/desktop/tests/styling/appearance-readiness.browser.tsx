import { afterEach, expect, test, vi } from 'vitest'
import type { AppearanceState } from '@/platform/contract/appearance'
import { acknowledgeRendererAppearance, applyAppearance } from '@/platform/renderer/use-appearance'
import { resetAppearanceDocument } from './browser-fixture'

afterEach(resetAppearanceDocument)

test('stale readiness retries only after applying the latest snapshot to DOM', async () => {
  const previous = window.argo
  const stale: AppearanceState = {
    theme: 'default',
    appearance: 'light',
    dark: false,
    revision: 0,
  }
  const current: AppearanceState = {
    theme: 'catppuccin',
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
