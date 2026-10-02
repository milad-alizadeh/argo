import { afterEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'
import { THEMES } from '@/platform/contract/appearance'
import { Button } from '@/platform/renderer/components/ui/button'
import { applyAppearance, useTheme } from '@/platform/renderer/use-appearance'
import { drawnColor, mountSpecimen, resetAppearanceDocument } from './browser-fixture'
import { contrastRatio } from './contrast'

let cleanup = () => {}
let revision = 0
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})

function ThemeConsumer() {
  const state = useTheme()
  return <div className="bg-popover text-popover-foreground">{state.theme}</div>
}

test('accepted Theme invalidates a same-Mode snapshot and body portals inherit it', async () => {
  applyAppearance({ theme: 'catppuccin', appearance: 'dark', dark: true, revision: ++revision })
  const mounted = mountSpecimen(<ThemeConsumer />)
  cleanup = mounted.cleanup
  const sample = mounted.container.firstElementChild
  if (!sample) throw new Error('Missing portal sample')
  const initial = getComputedStyle(sample).backgroundColor
  expect(sample.textContent).toBe('catppuccin')
  applyAppearance({ theme: 'default', appearance: 'dark', dark: true, revision: ++revision })
  expect(getComputedStyle(sample).backgroundColor).not.toBe(initial)
  expect(document.documentElement.dataset.theme).toBe('default')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  await expect.poll(() => sample.textContent).toBe('default')
  applyAppearance({ theme: 'catppuccin', appearance: 'light', dark: false, revision: 0 })
  expect(document.documentElement.dataset.theme).toBe('default')
})

function expectDistinctPaint(first: string, second: string) {
  const firstColor = drawnColor(first).slice(0, 3)
  const secondColor = drawnColor(second).slice(0, 3)
  const distance = Math.hypot(
    ...firstColor.map((channel, index) => channel - (secondColor[index] ?? 0)),
  )
  // A 20-channel sRGB distance rejects the former Neutral/Zinc four-channel variation.
  expect(distance, 'Theme paint must change visibly').toBeGreaterThanOrEqual(20)
}

test.each(['light', 'dark'] as const)(
  '%s Theme changes actual primary, selected, action and focus paint while preserving Mode',
  async (appearance) => {
    const mounted = mountSpecimen(
      <div>
        <Button className="transition-none">Primary action</Button>
        <Button variant="secondary" className="bg-selected text-foreground transition-none">
          Selected action
        </Button>
        <Button variant="link" className="transition-none">
          Link action
        </Button>
      </div>,
    )
    cleanup = mounted.cleanup
    const [primary, selected, action] = mounted.container.querySelectorAll('button')
    if (!primary || !selected || !action) throw new Error('Missing theme paint controls')
    primary.focus()
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}')
    const paints: Array<{ primary: string; selected: string; action: string; focus: string }> = []
    for (const theme of THEMES) {
      applyAppearance({ theme, appearance, dark: appearance === 'dark', revision: ++revision })
      expect(document.documentElement.style.colorScheme).toBe(appearance)
      const primaryStyle = getComputedStyle(primary)
      const selectedStyle = getComputedStyle(selected)
      const actionStyle = getComputedStyle(action)
      const rootStyle = getComputedStyle(document.documentElement)
      const paint = {
        primary: primaryStyle.backgroundColor,
        selected: selectedStyle.backgroundColor,
        action: actionStyle.color,
        focus: primaryStyle.borderColor,
      }
      expect(primary.matches(':focus-visible')).toBe(true)
      expect(drawnColor(paint.focus)).toEqual(drawnColor(rootStyle.getPropertyValue('--ring')))
      expect(
        contrastRatio(primaryStyle.color, paint.primary),
        `${theme} primary`,
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(selectedStyle.color, paint.selected),
        `${theme} selected`,
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrastRatio(paint.action, rootStyle.getPropertyValue('--background')),
      ).toBeGreaterThanOrEqual(4.5)
      for (const previous of paints) {
        for (const role of ['primary', 'selected', 'action', 'focus'] as const) {
          expectDistinctPaint(paint[role], previous[role])
        }
      }
      paints.push(paint)
    }
  },
)

test.each([
  ['light', '#171717', '#18181b'],
  ['dark', '#e5e5e5', '#e4e4e7'],
] as const)(
  '%s former Neutral/Zinc palettes fail the rendered identity requirement',
  (_appearance, neutral, zinc) => {
    expect(() => expectDistinctPaint(neutral, zinc)).toThrow()
  },
)
