import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { AppToneTreatments } from '@/mocks/styling/badges'
import { THEMES } from '@/platform/contract/appearance'
import {
  drawnColor,
  initializeShellAndSessionLocales,
  mountSpecimen,
  resetAppearanceDocument,
} from './browser-fixture'
import { contrastRatio } from './contrast'

let cleanup = () => {}
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})
beforeAll(initializeShellAndSessionLocales)

describe.each(THEMES)('%s app tones', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s paired surfaces and independent indicator ink',
    (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<AppToneTreatments />)
      cleanup = mounted.cleanup
      const elements = mounted.container.querySelectorAll('[data-treatment]')
      expect(elements).toHaveLength(9)
      for (const element of elements) {
        const style = getComputedStyle(element)
        if (element.getAttribute('data-treatment') === 'indicator') {
          expect(drawnColor(style.backgroundColor)).toEqual(drawnColor(style.color))
          for (const role of ['--background', '--card', '--selected', '--muted', '--popover']) {
            const ground = getComputedStyle(document.documentElement).getPropertyValue(role)
            expect(contrastRatio(style.color, ground)).toBeGreaterThanOrEqual(3)
          }
        } else {
          expect(drawnColor(style.backgroundColor)[3]).toBe(255)
          expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5)
        }
      }
    },
  )
})
