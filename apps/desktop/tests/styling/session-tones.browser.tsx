import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { WORK_STATE_MARKS } from '@/domains/sessions/renderer/work/presentation/session-work'
import { SessionToneSamples, WorkCountSamples } from '@/mocks/styling/session-tones'
import { THEMES } from '@/platform/contract/appearance'
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

test('active Session and running Work marks keep their glow on independent indicator ink', () => {
  const root = document.documentElement
  const previousIndicator = root.style.getPropertyValue('--active-indicator')
  const previousActive = root.style.getPropertyValue('--active')
  const previousIndicatorPriority = root.style.getPropertyPriority('--active-indicator')
  const previousActivePriority = root.style.getPropertyPriority('--active')
  root.style.setProperty('--active-indicator', 'rgb(18, 104, 90)')
  root.style.setProperty('--active', 'rgb(190, 70, 40)')
  try {
    const mounted = mountSpecimen(
      <div>
        <SessionToneSamples />
        <span className={WORK_STATE_MARKS.running} data-running-work />
        <span
          data-expected
          style={{ boxShadow: '0 0 6px color-mix(in srgb, rgb(18, 104, 90) 50%, transparent)' }}
        />
      </div>,
    )
    cleanup = mounted.cleanup
    const expected = mounted.container.querySelector('[data-expected]')
    if (!expected) throw new Error('Missing expected glow')
    for (const selector of [
      '[data-slot="session-status"][data-variant="active"]',
      '[data-running-work]',
    ]) {
      const mark = mounted.container.querySelector(selector)
      if (!mark) throw new Error('Missing running mark')
      const style = getComputedStyle(mark)
      expect(drawnColor(style.backgroundColor)).toEqual(drawnColor('rgb(18, 104, 90)'))
      expect(drawnColor(style.color)).toEqual(drawnColor('rgb(18, 104, 90)'))
      expect(style.boxShadow).toContain(getComputedStyle(expected).boxShadow)
    }
  } finally {
    if (previousIndicator)
      root.style.setProperty('--active-indicator', previousIndicator, previousIndicatorPriority)
    else root.style.removeProperty('--active-indicator')
    if (previousActive) root.style.setProperty('--active', previousActive, previousActivePriority)
    else root.style.removeProperty('--active')
  }
})

describe.each(THEMES)('%s Session status', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s attention keeps native Badge text and row selection',
    async (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const selected = vi.fn()
      const mounted = mountSpecimen(<SessionToneSamples onSelect={selected} />)
      cleanup = mounted.cleanup
      const attention = page.getByRole('button', { name: /Question Session/ })
      const badge = attention.element().querySelector('[data-slot="badge"]')
      if (!badge) throw new Error('Missing attention badge')
      expect(badge.tagName).toBe('SPAN')
      expect(badge.textContent).toBe('Needs input')
      expect(metrics(badge)).toEqual({
        size: '12px',
        lineHeight: '16px',
        weight: '500',
        tracking: 'normal',
      })
      const paint = getComputedStyle(badge)
      expect(paint.height).toBe('20px')
      expect(contrastRatio(paint.color, paint.backgroundColor)).toBeGreaterThanOrEqual(4.5)
      expect(attention.element().querySelector('button, a, [tabindex]')).toBeNull()
      await attention.click()
      expect(selected).toHaveBeenCalledWith('asking')
      const marks = mounted.container.querySelectorAll('[data-slot="session-status"]')
      expect(marks).toHaveLength(8)
      for (const mark of marks) {
        const style = getComputedStyle(mark)
        if (mark.getAttribute('data-variant') === 'unknown') {
          expect(drawnColor(style.backgroundColor)[3]).toBe(0)
          expect(style.boxShadow).not.toBe('none')
        } else {
          expect(drawnColor(style.backgroundColor)).toEqual(drawnColor(style.color))
        }
      }
    },
  )
})

describe.each(THEMES)('%s Session notification count', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s current count geometry and paired filled paint',
    async (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<WorkCountSamples />)
      cleanup = mounted.cleanup
      for (const label of ['Running work · 1', 'Finished work · 1']) {
        const button = page.getByRole('button', { name: label, exact: true })
        const badge = button.element().querySelector('span[aria-hidden="true"]')
        if (!badge) throw new Error('Missing notification count')
        const style = getComputedStyle(badge)
        expect(style.height).toBe('14px')
        expect(style.minWidth).toBe('14px')
        expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5)
        expect(badge.textContent).toBe('1')
      }
      await page.getByRole('button', { name: 'Running work · 1', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Review interface Running' }).click()
      await expect.element(page.getByLabelText('Selected work')).toHaveTextContent('running-work')
    },
  )
})
