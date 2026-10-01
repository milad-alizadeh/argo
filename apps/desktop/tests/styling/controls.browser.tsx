import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { ButtonSpecimen, InputSpecimen } from '@/mocks/styling/controls'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { metrics, mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())

for (const appearance of ['light', 'dark']) {
  test.each([false, true])(
    `${appearance} button measurements, icons and keyboard ring; adapted=%s`,
    async (adapted) => {
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<ButtonSpecimen adapted={adapted} />)
      cleanup = mounted.cleanup
      const save = page.getByRole('button', { name: 'Save', exact: true }).element()
      expect(save.getBoundingClientRect().height).toBe(32)
      expect(metrics(save)).toEqual({
        size: '14px',
        lineHeight: '20px',
        weight: adapted ? '400' : '500',
        tracking: 'normal',
      })
      for (const [name, height, iconWidth] of [
        ['Small', 28, 14],
        ['Extra small', 24, 12],
        ['Large', 36, 16],
      ] as const) {
        const control = page.getByRole('button', { name, exact: true }).element()
        expect(control.getBoundingClientRect().height).toBe(height)
        expect(control.querySelector('svg')?.getBoundingClientRect().width).toBe(iconWidth)
      }
      const small = page.getByRole('button', { name: 'Small', exact: true }).element()
      expect(metrics(small).size).toBe(adapted ? '14px' : '12.8px')
      save.focus()
      await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}')
      expect(save.matches(':focus-visible')).toBe(true)
      await expect.poll(() => getComputedStyle(save).boxShadow).toContain('3px')
    },
  )

  test.each([480, 1024])(
    `${appearance} input default and adaptation retain focus at viewport %s`,
    async (width) => {
      await page.viewport(width, 720)
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(
        <>
          <InputSpecimen />
          <InputSpecimen adapted />
        </>,
      )
      cleanup = mounted.cleanup
      const inputs = page.getByRole('textbox', { name: 'Project name' }).elements()
      const [direct, adapted] = inputs
      if (!direct || !adapted) throw new Error('Both input specimens must be mounted')
      expect(metrics(direct)).toMatchObject({
        size: width < 768 ? '16px' : '14px',
        lineHeight: width < 768 ? '24px' : '20px',
      })
      expect(metrics(adapted)).toEqual({
        size: '13px',
        lineHeight: '19px',
        weight: '400',
        tracking: 'normal',
      })
      for (const input of inputs) {
        expect(input.getBoundingClientRect().height).toBe(32)
        expect(getComputedStyle(input).paddingLeft).toBe('10px')
        input.focus()
        await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}')
        expect(input.matches(':focus-visible')).toBe(true)
        expect(getComputedStyle(input).boxShadow).toContain('3px')
      }
      for (const invalid of page.getByRole('textbox', { name: 'Invalid input' }).elements()) {
        expect(getComputedStyle(invalid).boxShadow).toContain('3px')
        expect(getComputedStyle(invalid).borderColor).not.toBe(getComputedStyle(direct).borderColor)
      }
    },
  )

  test(`${appearance} app icon geometry belongs to Icon and primitive inheritance is explicit`, () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        <Icon aria-label="Default icon" name="search" />
        <Icon aria-label="Meta icon" name="search" size="meta" />
        <Icon aria-label="Inline icon" name="search" size="inline" />
        <Icon aria-label="Text icon" name="search" size="text" />
        <Icon aria-label="Explicit geometry" className="size-6" name="search" />
      </div>,
    )
    cleanup = mounted.cleanup
    for (const label of ['Default icon', 'Meta icon', 'Inline icon', 'Text icon']) {
      expect(page.getByLabelText(label).element().getBoundingClientRect().width).toBe(16)
    }
    expect(page.getByLabelText('Explicit geometry').element().getBoundingClientRect().width).toBe(
      24,
    )
  })
}
