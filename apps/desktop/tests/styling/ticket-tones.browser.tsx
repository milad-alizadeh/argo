import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { CONNECTION_STATES } from '@/domains/tickets/api/ticket'
import { ConnectionStatusMark } from '@/domains/tickets/renderer/connection/connection-status-mark'
import ticketsCatalog from '@/domains/tickets/renderer/locales/en.json'
import { StatusMenu } from '@/domains/tickets/renderer/status/status-menu'
import { STATUS_SAMPLES, TicketStatusSamples } from '@/mocks/styling/ticket-status'
import { THEMES } from '@/platform/contract/appearance'
import { i18n } from '@/platform/renderer/i18n/i18n'
import {
  drawnColor,
  initializeShellAndSessionLocales,
  mountSpecimen,
  resetAppearanceDocument,
} from './browser-fixture'

let cleanup = () => {}
afterEach(() => {
  cleanup()
  resetAppearanceDocument()
})
beforeAll(async () => {
  await initializeShellAndSessionLocales()
  i18n.addResourceBundle('en', 'tickets', ticketsCatalog)
})

function expectPriorityMarks(container: HTMLElement) {
  const root = getComputedStyle(document.documentElement)
  for (const level of ['none', '1', '2', '3', '4']) {
    const row = container.querySelector(`[data-priority="${level}"]`)
    const glyph = row?.querySelector('svg')
    if (!row || !glyph) throw new Error(`Missing priority ${level}`)
    const role = level === '1' ? '--danger-indicator' : '--neutral-indicator'
    expect(drawnColor(getComputedStyle(glyph).color)).toEqual(
      drawnColor(root.getPropertyValue(role)),
    )
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
    if (level === 'none') {
      expect(
        [...glyph.querySelectorAll('rect')].map((rect) => rect.getAttribute('height')),
      ).toEqual(['2', '2', '2'])
    } else if (level !== '1') {
      expect(
        [...glyph.querySelectorAll('rect')].map((rect) => rect.getAttribute('height')),
      ).toEqual(['4', '7', '10'])
    }
  }
}

describe.each(THEMES)('%s Ticket marks', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s keeps status shape and names with shared paint',
    (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(<TicketStatusSamples />)
      cleanup = mounted.cleanup
      expectPriorityMarks(mounted.container)
      const roles = {
        triage: '--warning-indicator',
        backlog: '--neutral-indicator',
        todo: '--neutral-indicator',
        progress: '--warning-indicator',
        done: '--complete-indicator',
        canceled: '--neutral-indicator',
        review: '--success-indicator',
      }
      const root = getComputedStyle(document.documentElement)
      for (const [id, role] of Object.entries(roles)) {
        const row = mounted.container.querySelector(`[data-status="${id}"]`)
        const glyph = row?.querySelector('svg')
        if (!row || !glyph) throw new Error(`Missing status ${id}`)
        expect(drawnColor(getComputedStyle(glyph).color)).toEqual(
          drawnColor(root.getPropertyValue(role)),
        )
        expect(glyph.getAttribute('aria-hidden')).toBe('true')
        expect(row.textContent).toBe(STATUS_SAMPLES.find((status) => status.id === id)?.name)
        expect(row.querySelector('button, a, [tabindex]')).toBeNull()
      }
      const backlog = mounted.container.querySelector('[data-status="backlog"] circle')
      expect(backlog?.getAttribute('stroke-dasharray')).toBe('1.2 0.8')
      const progress = mounted.container.querySelector(
        '[data-status="progress"] [stroke-dasharray]',
      )
      expect(progress?.getAttribute('stroke-dasharray')).toBe('50 100')
      expect(
        mounted.container.querySelector('[data-status="done"] mask path')?.getAttribute('d'),
      ).toContain('9.75 5.25')
      expect(
        mounted.container.querySelector('[data-status="canceled"] mask path')?.getAttribute('d'),
      ).toContain('l4 4')
    },
  )
})

describe.each(THEMES)('%s Connection marks', (theme) => {
  test.each(['light', 'dark'] as const)(
    '%s Connection unavailable stays hollow and states stay named',
    (appearance) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(
        <div>
          {CONNECTION_STATES.map((state) => (
            <p data-state={state} key={state}>
              <ConnectionStatusMark state={state}>Account</ConnectionStatusMark>
            </p>
          ))}
        </div>,
      )
      cleanup = mounted.cleanup
      for (const state of CONNECTION_STATES) {
        const row = mounted.container.querySelector(`[data-state="${state}"]`)
        const mark = row?.querySelector('[aria-hidden="true"]')
        if (!row || !mark) throw new Error(`Missing Connection state ${state}`)
        expect(row.textContent).toBe(
          `Account${i18n.t(`connection.state.${state}`, { ns: 'tickets' })}`,
        )
        expect(row.querySelector('button, a, [tabindex]')).toBeNull()
        const style = getComputedStyle(mark)
        if (state === 'account-missing') {
          expect(drawnColor(style.backgroundColor)[3]).toBe(0)
          expect(style.boxShadow).not.toBe('none')
        } else {
          const role = state === 'ready' ? '--active-indicator' : '--danger-indicator'
          expect(drawnColor(style.backgroundColor)).toEqual(
            drawnColor(getComputedStyle(document.documentElement).getPropertyValue(role)),
          )
        }
      }
    },
  )
})

test('real Ticket metadata menu preserves button semantics and controlled selection', async () => {
  const status = STATUS_SAMPLES[0]
  const next = STATUS_SAMPLES[1]
  if (!status || !next) throw new Error('Missing workflow fixtures')
  const changed = vi.fn()
  const mounted = mountSpecimen(
    <StatusMenu
      metadata
      named
      noun="Status"
      onChange={changed}
      status={status}
      statuses={STATUS_SAMPLES}
    />,
  )
  cleanup = mounted.cleanup
  const trigger = page.getByRole('button', { name: 'Status: Triage' })
  expect(trigger.element().tagName).toBe('BUTTON')
  await trigger.click()
  await expect
    .element(page.getByRole('menuitemradio', { name: 'Triage', exact: true }))
    .toBeChecked()
  await page.getByRole('menuitemradio', { name: 'Backlog', exact: true }).click()
  expect(changed).toHaveBeenCalledWith(next)
  await expect.element(trigger).toHaveTextContent('Triage')
  await trigger.click()
  await expect
    .element(page.getByRole('menuitemradio', { name: 'Triage', exact: true }))
    .toBeChecked()
})
