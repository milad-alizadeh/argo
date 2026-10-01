import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import {
  ButtonSpecimen,
  InputSpecimen,
  longControlLabel,
  longInputValue,
} from '@/mocks/styling/controls'
import { mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())

for (const appearance of ['light', 'dark']) {
  test.each([480, 1024])(
    `${appearance} long content and disabled controls fit viewport %s`,
    async (width) => {
      await page.viewport(width, 720)
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(
        <div className="grid gap-6">
          <ButtonSpecimen />
          <ButtonSpecimen adapted />
          <InputSpecimen />
          <InputSpecimen adapted />
        </div>,
      )
      cleanup = mounted.cleanup
      for (const button of page.getByRole('button', { name: longControlLabel }).elements()) {
        expect(button.getBoundingClientRect().width).toBeLessThanOrEqual(width)
        const label = button.querySelector('span')
        if (!label) throw new Error('The long button label must be mounted')
        expect(label.scrollWidth).toBeGreaterThan(label.clientWidth)
        expect(getComputedStyle(label).textOverflow).toBe('ellipsis')
      }
      for (const input of page.getByRole('textbox', { name: 'Long path' }).elements()) {
        expect(input).toHaveValue(longInputValue)
        expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(width)
      }
      for (const disabled of [
        ...page.getByRole('button', { name: 'Unavailable' }).elements(),
        ...page.getByRole('textbox', { name: 'Unavailable input' }).elements(),
      ]) {
        expect(disabled).toBeDisabled()
        expect(getComputedStyle(disabled).opacity).toBe('0.5')
        expect(getComputedStyle(disabled).pointerEvents).toBe('none')
      }
    },
  )
}
