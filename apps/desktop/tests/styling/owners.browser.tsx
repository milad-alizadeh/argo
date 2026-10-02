import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { ComposerEditingProvider } from '@/domains/sessions/renderer/composer/editing/composer-editing-context'
import { ComposerEditor } from '@/domains/sessions/renderer/composer/editor/session-composer-editor'
import { AppNavigationRail } from '@/platform/renderer/shell/components/app-navigation-rail'
import { applyAppearance } from '@/platform/renderer/use-appearance'
import { initializeShellAndSessionLocales, mountSpecimen } from './browser-fixture'

let cleanup = () => {}
afterEach(() => cleanup())
beforeAll(initializeShellAndSessionLocales)

describe.each(['light', 'dark'] as const)('%s existing owners', (appearance) => {
  test('the navigation rail updates the current page after selection', async () => {
    applyAppearance({ theme: 'default', appearance, dark: appearance === 'dark', revision: 0 })
    const mounted = mountSpecimen(
      <MemoryRouter initialEntries={['/projects/styling-fixture/sessions']}>
        <AppNavigationRail />
      </MemoryRouter>,
    )
    cleanup = mounted.cleanup
    await page.getByRole('button', { name: 'Tickets', exact: true }).click()
    await expect
      .element(page.getByRole('button', { name: 'Tickets', exact: true }))
      .toHaveAttribute('aria-current', 'page')
  })
})

describe.each(['light', 'dark'])('%s existing Composer', (appearance) => {
  test('the Composer exposes heading levels', async () => {
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
    for (const [name, level] of [
      ['Main', 1],
      ['Secondary', 2],
      ['Tertiary', 3],
    ] as const) {
      const heading = page.getByRole('heading', { name, level })
      await expect.element(heading).toBeVisible()
    }
  })
})
