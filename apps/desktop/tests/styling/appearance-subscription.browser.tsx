import { afterEach, expect, test, vi } from 'vitest'
import type { AppearanceState } from '@/platform/contract/appearance'
import {
  acknowledgeRendererAppearance,
  initializeRendererAppearance,
} from '@/platform/renderer/use-appearance'
import { resetAppearanceDocument } from './browser-fixture'

afterEach(resetAppearanceDocument)

test('subscription application acknowledges later revisions only after startup readiness', async () => {
  const previous = window.argo
  let current: AppearanceState = {
    theme: 'neutral',
    appearance: 'light',
    dark: false,
    revision: 0,
  }
  let receive: ((state: AppearanceState) => void) | undefined
  const acknowledge = vi.fn(async (revision: number) => {
    expect(revision).toBe(current.revision)
    expect(document.documentElement.dataset.theme).toBe(current.theme)
    expect(document.documentElement.classList.contains('dark')).toBe(current.dark)
    return { ready: true, state: current }
  })
  window.argo = {
    ...previous,
    getAppearance: async () => current,
    onAppearanceChanged: (listener) => {
      receive = listener
      return () => {}
    },
    appearanceReady: acknowledge,
  }
  try {
    await initializeRendererAppearance()
    await acknowledgeRendererAppearance()
    current = { theme: 'graphite', appearance: 'system', dark: true, revision: 1 }
    if (!receive) throw new Error('Missing appearance subscription')
    receive(current)
    await expect.poll(() => acknowledge.mock.calls.map(([revision]) => revision)).toEqual([0, 1])
  } finally {
    try {
      await acknowledgeRendererAppearance()
    } finally {
      window.argo = previous
    }
  }
})
