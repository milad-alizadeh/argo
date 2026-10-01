import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { ComposerEditingProvider } from '@/domains/sessions/renderer/composer/editing/composer-editing-context'
import { ComposerEditor } from '@/domains/sessions/renderer/composer/editor/session-composer-editor'
import sessionsCatalog from '@/domains/sessions/renderer/locales/en.json'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { initializeRendererI18n } from '@/platform/renderer/i18n/i18n'
import { AppNavigationRail } from '@/platform/renderer/shell/components/app-navigation-rail'
import appCatalog from '@/platform/renderer/shell/locales/app.json'
import { metrics, mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())
beforeAll(async () => {
  await initializeRendererI18n({
    catalogs: { app: appCatalog, sessions: sessionsCatalog },
    defaultNamespace: 'app',
    language: 'en',
  })
})

describe.each(['light', 'dark'])('%s existing owners', (appearance) => {
  test('the real navigation rail owns all four 20px icons', async () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <MemoryRouter initialEntries={['/projects/styling-fixture/sessions']}>
        <AppNavigationRail />
      </MemoryRouter>,
    )
    cleanup = mounted.cleanup
    for (const label of ['Sessions', 'Tickets', 'Atlas', 'Settings']) {
      const icon = page
        .getByRole('button', { name: label, exact: true })
        .element()
        .querySelector('svg')
      expect(icon).not.toBeNull()
      expect(getComputedStyle(icon as SVGElement)).toMatchObject({ width: '20px', height: '20px' })
    }
    await page.getByRole('button', { name: 'Tickets', exact: true }).click()
    await expect
      .element(page.getByRole('button', { name: 'Tickets', exact: true }))
      .toHaveAttribute('aria-current', 'page')
  })
})

describe.each(['light', 'dark'])('%s existing Badge', (appearance) => {
  test('the real Badge preserves default and compact emphasis', () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <div>
        <Badge>Default badge</Badge>
        <Badge size="compact">Compact badge</Badge>
      </div>,
    )
    cleanup = mounted.cleanup
    expect(metrics(page.getByText('Default badge').element())).toEqual({
      size: '12px',
      lineHeight: '16px',
      weight: '500',
      tracking: 'normal',
    })
    expect(metrics(page.getByText('Compact badge').element())).toEqual({
      size: '12px',
      lineHeight: '16px',
      weight: '400',
      tracking: 'normal',
    })
  })
})

describe.each(['light', 'dark'])('%s existing Composer', (appearance) => {
  test('the real Composer retains complete semibold heading recipes', async () => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const mounted = mountSpecimen(
      <ComposerEditingProvider
        owner="styling-fixture"
        initial={{ prompt: '# Main\n\n## Secondary\n\n### Tertiary' }}
      >
        <ComposerEditor
          commands={{ availability: 'listed', commands: [] }}
          contextPickerOpen={false}
          editorRef={createRef()}
          focusOnMount={false}
          onSend={() => {}}
        />
      </ComposerEditingProvider>,
    )
    cleanup = mounted.cleanup
    for (const [name, level, size, lineHeight] of [
      ['Main', 1, '18px', '24px'],
      ['Secondary', 2, '14px', '20px'],
      ['Tertiary', 3, '14px', '20px'],
    ] as const) {
      const heading = page.getByRole('heading', { name, level })
      await expect.element(heading).toBeVisible()
      expect(metrics(heading.element())).toEqual({
        size,
        lineHeight,
        weight: '600',
        tracking: 'normal',
      })
    }
  })
})
