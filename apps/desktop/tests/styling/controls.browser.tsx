import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { ButtonSpecimen, InputSpecimen } from '@/mocks/styling/controls'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { metrics, mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())

for (const appearance of ['light', 'dark']) {
  test(`${appearance} registry button measurements, icons and keyboard ring`, async () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(<ButtonSpecimen />)
    cleanup = mounted.cleanup
    const save = page.getByRole('button', { name: 'Save', exact: true }).element()
    expect(save.getBoundingClientRect().height).toBe(32)
    expect(metrics(save)).toEqual({
      size: '14px',
      lineHeight: '20px',
      weight: '500',
      tracking: 'normal',
    })
    for (const [name, height, iconWidth, size, lineHeight] of [
      ['Small', 28, 14, '12.8px', '19.2px'],
      ['Extra small', 24, 12, '12px', '16px'],
      ['Large', 36, 16, '14px', '20px'],
    ] as const) {
      const control = page.getByRole('button', { name, exact: true }).element()
      expect(control.getBoundingClientRect().height).toBe(height)
      expect(control.querySelector('svg')?.getBoundingClientRect().width).toBe(iconWidth)
      expect(metrics(control)).toEqual({ size, lineHeight, weight: '500', tracking: 'normal' })
    }
    save.focus()
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}')
    expect(save.matches(':focus-visible')).toBe(true)
    await expect.poll(() => getComputedStyle(save).boxShadow).toContain('3px')
  })

  test.each([480, 1024])(
    `${appearance} registry input typography and focus at viewport %s`,
    async (width) => {
      await page.viewport(width, 720)
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<InputSpecimen />)
      cleanup = mounted.cleanup
      const inputs = page.getByRole('textbox', { name: 'Project name' }).elements()
      const direct = inputs[0]
      if (!direct) throw new Error('The input specimen must be mounted')
      expect(metrics(direct)).toEqual({
        size: width < 768 ? '16px' : '14px',
        lineHeight: width < 768 ? '24px' : '20px',
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
