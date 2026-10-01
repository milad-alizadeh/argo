import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { parseSetupDocument } from '@/domains/projects/renderer/onboarding/model/setup-document'
import { SetupPlanField } from '@/domains/projects/renderer/onboarding/plan/setup-plan-field'
import { UsagePopover } from '@/domains/sessions/renderer/composer/context-bar/usage-popover'
import { ContextPopover } from '@/domains/sessions/renderer/composer/context-window/context-popover'
import { SessionPlanPopover } from '@/domains/sessions/renderer/composer/layout/session-plan-popover'
import { ComposerMenuTrigger } from '@/domains/sessions/renderer/composer/toolbar/composer-menu-trigger'
import sessionsCatalog from '@/domains/sessions/renderer/locales/en.json'
import { SourceSettings } from '@/domains/tickets/renderer/connection/source-settings'
import ticketsCatalog from '@/domains/tickets/renderer/locales/en.json'
import { ticketMenuTrigger } from '@/domains/tickets/renderer/status/ticket-menu-trigger'
import { SidebarSearch } from '@/platform/renderer/components/sidebar-search'
import { Button } from '@/platform/renderer/components/ui/button'
import { DropdownMenu } from '@/platform/renderer/components/ui/dropdown-menu'
import { Input } from '@/platform/renderer/components/ui/input'
import { Item, ItemActions } from '@/platform/renderer/components/ui/item'
import { initializeRendererI18n } from '@/platform/renderer/i18n/i18n'
import { metrics, mountSpecimen } from './browser-fixture'

const documentFixture = parseSetupDocument({
  version: 1,
  requiredCapabilities: ['fields'],
  revision: 'styling-fixture',
  locales: {
    en: {
      title: 'Setup',
      description: 'Setup fixture',
      fields: { path: { label: 'Project path' } },
      plan: {},
    },
  },
  fields: [{ id: 'path', type: 'text', configurationPath: ['path'] }],
  configuration: {},
  plan: [],
})
const pathField = documentFixture.fields[0]
if (!pathField) throw new Error('The path field must be declared')

let cleanup = () => {}
afterEach(() => cleanup())
beforeAll(async () => {
  await initializeRendererI18n({
    catalogs: { tickets: ticketsCatalog, sessions: sessionsCatalog },
    defaultNamespace: 'tickets',
    language: 'en',
  })
})

describe.each(['light', 'dark'])('%s app callers', (appearance) => {
  test('Source settings keeps registry small Button typography', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        <Item>
          <ItemActions>
            <Button size="sm">Baseline button</Button>
          </ItemActions>
        </Item>
        <SourceSettings
          connection={null}
          disconnecting={false}
          error={null}
          onConnect={() => {}}
          onDisconnect={() => {}}
        />
      </div>,
    )
    cleanup = mounted.cleanup
    const buttons = page.getByRole('button').elements()
    expect(buttons).toHaveLength(2)
    const baseline = page.getByRole('button', { name: 'Baseline button' }).element()
    const source = page.getByRole('button', { name: 'Connect a Ticket source' }).element()
    expect(metrics(baseline)).toMatchObject({ size: '12.8px', weight: '500', tracking: 'normal' })
    expect(metrics(source)).toEqual(metrics(baseline))
  })

  test.each([480, 1024])(
    'path and sidebar inputs keep registry typography at viewport %s',
    async (width) => {
      await page.viewport(width, 720)
      document.documentElement.classList.toggle('dark', appearance === 'dark')
      const mounted = mountSpecimen(
        <div>
          <Input aria-label="Baseline input" />
          <SetupPlanField
            document={documentFixture}
            field={pathField}
            language="en"
            mono
            onChange={() => {}}
            value="/workspace/argo"
          />
          <SidebarSearch label="Sidebar search" placeholder="Search" onChange={() => {}} value="" />
        </div>,
      )
      cleanup = mounted.cleanup
      const inputs = page.getByRole('textbox').elements()
      expect(inputs).toHaveLength(3)
      for (const input of inputs) {
        expect(metrics(input)).toEqual({
          size: width < 768 ? '16px' : '14px',
          lineHeight: width < 768 ? '24px' : '20px',
          weight: '400',
          tracking: 'normal',
        })
      }
      expect(
        getComputedStyle(page.getByRole('textbox', { name: 'Project path' }).element()).fontFamily,
      ).toContain('Geist Mono')
    },
  )
})

describe.each(['light', 'dark'])('%s Composer and Ticket callers', (appearance) => {
  test('Usage, Context and Plan triggers keep registry small Button typography', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        <UsagePopover harness="claude" />
        <ContextPopover compact capacityTokens={100000} percentage={25} usedTokens={25000} />
        <ContextPopover labelled capacityTokens={100000} percentage={25} usedTokens={25000} />
        <SessionPlanPopover plan={{ state: 'counted', completed: 1, total: 3 }} />
      </div>,
    )
    cleanup = mounted.cleanup
    const buttons = page.getByRole('button').elements()
    expect(buttons).toHaveLength(4)
    for (const button of buttons) {
      expect(metrics(button)).toEqual({
        size: '12.8px',
        lineHeight: '19.2px',
        weight: '500',
        tracking: 'normal',
      })
    }
  })

  test('Ticket and forwarded InputGroup triggers retain their registry size contracts', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        {ticketMenuTrigger(true, false)}
        <DropdownMenu>
          <ComposerMenuTrigger ariaLabel="Composer menu">Menu</ComposerMenuTrigger>
        </DropdownMenu>
      </div>,
    )
    cleanup = mounted.cleanup
    const ticket = mounted.container.querySelector('[data-slot="button"]')
    if (!ticket) throw new Error('The Ticket trigger must be mounted')
    expect(metrics(ticket)).toEqual({
      size: '12px',
      lineHeight: '16px',
      weight: '500',
      tracking: 'normal',
    })
    expect(metrics(page.getByRole('button', { name: 'Composer menu' }).element())).toEqual({
      size: '14px',
      lineHeight: '20px',
      weight: '500',
      tracking: 'normal',
    })
  })
})
