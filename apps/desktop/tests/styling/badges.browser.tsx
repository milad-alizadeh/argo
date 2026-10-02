import { createRef } from 'react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { NATIVE_BADGE_VARIANTS, NativeBadges } from '@/mocks/styling/badges'
import { THEMES } from '@/platform/contract/appearance'
import { StatusBadge } from '@/platform/renderer/components/design-system/status-badge'
import { Badge } from '@/platform/renderer/components/ui/badge'
import {
  drawnColor,
  initializeShellAndSessionLocales,
  metrics,
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

function expectNativeMeasurements(badge: Element) {
  expect(metrics(badge)).toEqual({
    size: '12px',
    lineHeight: '16px',
    weight: '500',
    tracking: 'normal',
  })
  expect(getComputedStyle(badge)).toMatchObject({
    height: '20px',
    paddingLeft: '8px',
    paddingRight: '8px',
  })
  expect(badge.tagName).toBe('SPAN')
  expect(badge.hasAttribute('tabindex')).toBe(false)
}

describe.each(THEMES)('%s native Badge', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s native measurements and destructive state',
    async (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<NativeBadges />)
      cleanup = mounted.cleanup
      for (const variant of NATIVE_BADGE_VARIANTS) {
        const badge = page.getByText(variant, { exact: true }).element()
        expectNativeMeasurements(badge)
      }
      const remove = page.getByRole('button', { name: 'Remove badge' })
      await userEvent.tab()
      await expect.element(page.getByRole('link', { name: 'Badge destination' })).toHaveFocus()
      await userEvent.tab()
      await expect.element(remove).toHaveFocus()
      await expect.poll(() => getComputedStyle(remove.element()).boxShadow).toContain('3px')
      const focused = getComputedStyle(remove.element())
      expect(focused.boxShadow).not.toBe('none')
      expect(focused.boxShadow).toContain('3px')
      await expect
        .poll(() => drawnColor(getComputedStyle(remove.element()).borderColor))
        .toEqual(drawnColor(getComputedStyle(document.documentElement).getPropertyValue('--ring')))
      expect(focused.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      expect(
        contrastRatio(
          focused.color,
          focused.backgroundColor,
          getComputedStyle(document.documentElement).getPropertyValue('--background'),
        ),
      ).toBeGreaterThanOrEqual(4.5)
      await userEvent.keyboard('{Enter}')
      await expect.element(page.getByLabelText('Removal count')).toHaveTextContent('1')
      await expect.element(page.getByRole('button', { name: 'Disabled badge' })).toBeDisabled()
      const buttonPaint = getComputedStyle(remove.element()).backgroundColor
      await remove.hover()
      expect(getComputedStyle(remove.element()).backgroundColor).toBe(buttonPaint)
      for (const name of ['Badge destination', 'Destructive destination']) {
        const anchor = page.getByRole('link', { name })
        expect(anchor.element().tagName).toBe('A')
        const initial = getComputedStyle(anchor.element()).backgroundColor
        await anchor.hover()
        if (name === 'Destructive destination' && appearance === 'dark') {
          expect(getComputedStyle(anchor.element()).backgroundColor).toBe(initial)
        } else {
          await expect
            .poll(() => getComputedStyle(anchor.element()).backgroundColor)
            .not.toBe(initial)
        }
      }
    },
  )
})

test('app display badge preserves the native typography, ref and attributes', () => {
  const reference = createRef<HTMLSpanElement>()
  const mounted = mountSpecimen(
    <div>
      <Badge>Native</Badge>
      <StatusBadge
        aria-label="Attention status"
        data-evidence="kept"
        ref={reference}
        title="Attention"
        tone="warning"
      >
        Needs input
      </StatusBadge>
    </div>,
  )
  cleanup = mounted.cleanup
  const badge = page.getByText('Needs input').element()
  expect(reference.current).toBe(badge)
  expect(badge.tagName).toBe('SPAN')
  expect(badge.hasAttribute('tabindex')).toBe(false)
  expect(badge.getAttribute('data-evidence')).toBe('kept')
  expect(badge.getAttribute('aria-label')).toBe('Attention status')
  expect(badge.getAttribute('title')).toBe('Attention')
  expect(metrics(badge)).toEqual(metrics(page.getByText('Native', { exact: true }).element()))
  expect(getComputedStyle(badge).height).toBe('20px')
})
