import { afterEach, expect, test } from 'vitest'
import { applyAppearance } from '@/platform/renderer/use-appearance'
import { mountSpecimen, resetAppearanceDocument } from './browser-fixture'

let cleanup = () => {}
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})

test('accepted identity invalidates a same-appearance snapshot and body portals inherit it', () => {
  applyAppearance({ theme: 'neutral', appearance: 'dark', dark: true, revision: 1 })
  const mounted = mountSpecimen(
    <div className="bg-popover text-popover-foreground">Portal sample</div>,
  )
  cleanup = mounted.cleanup
  const sample = mounted.container.firstElementChild
  if (!sample) throw new Error('Missing portal sample')
  const initial = getComputedStyle(sample).backgroundColor
  applyAppearance({ theme: 'graphite', appearance: 'dark', dark: true, revision: 2 })
  expect(getComputedStyle(sample).backgroundColor).not.toBe(initial)
  expect(document.documentElement.dataset.theme).toBe('graphite')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  applyAppearance({ theme: 'neutral', appearance: 'light', dark: false, revision: 0 })
  expect(document.documentElement.dataset.theme).toBe('graphite')
})
