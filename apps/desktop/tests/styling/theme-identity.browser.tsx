import { afterEach, expect, test } from 'vitest'
import { applyAppearance, useTheme } from '@/platform/renderer/use-appearance'
import { mountSpecimen, resetAppearanceDocument } from './browser-fixture'

let cleanup = () => {}
let revision = 0
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})

function ThemeConsumer() {
  const state = useTheme()
  return <div>{state.theme}</div>
}

test('accepted Theme invalidates a same-Mode snapshot', async () => {
  applyAppearance({ theme: 'catppuccin', appearance: 'dark', dark: true, revision: ++revision })
  const mounted = mountSpecimen(<ThemeConsumer />)
  cleanup = mounted.cleanup
  const sample = mounted.container.firstElementChild
  if (!sample) throw new Error('Missing portal sample')
  expect(sample.textContent).toBe('catppuccin')
  applyAppearance({ theme: 'default', appearance: 'dark', dark: true, revision: ++revision })
  expect(document.documentElement.dataset.theme).toBe('default')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  await expect.poll(() => sample.textContent).toBe('default')
  applyAppearance({ theme: 'catppuccin', appearance: 'light', dark: false, revision: 0 })
  expect(document.documentElement.dataset.theme).toBe('default')
})
