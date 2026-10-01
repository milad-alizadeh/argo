import { IconContext } from '@phosphor-icons/react'
import type { Preview } from '@storybook/react-vite'
import { createElement } from 'react'
import { storyPreloads } from '../mocks/platform/story-preload'
import { SessionChanges } from '../src/domains/sessions/renderer'
import { AppQueryProvider } from '../src/platform/renderer/app-query-provider'
import { AutoHideScrollbars } from '../src/platform/renderer/auto-hide-scrollbars'
import '../src/renderer/i18n'
import '../src/platform/renderer/styles/globals.css'
import { type AppearanceState, THEMES } from '../src/platform/contract/appearance'
import { applyAppearance } from '../src/platform/renderer/use-appearance'
import { host } from './storybook-host'

let appearanceRevision = 0

const preview: Preview = {
  // Once per stories file under Vitest, so a cold module load is not charged to its first story.
  beforeAll: async () => {
    await storyPreloads()
  },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === 'dark'
      const theme =
        THEMES.find((candidate) => candidate === context.globals.themeIdentity) ?? 'neutral'
      let state: AppearanceState = {
        theme,
        appearance: 'system',
        dark,
        revision: ++appearanceRevision,
      }
      applyAppearance(state)
      host.argo = {
        ...host.argo,
        getAppearance: () => Promise.resolve(state),
        setAppearance: async (preference) => {
          state = {
            ...preference,
            dark: preference.appearance === 'system' ? dark : preference.appearance === 'dark',
            revision: ++appearanceRevision,
          }
          applyAppearance(state)
          return { ok: true, state }
        },
      } as typeof host.argo
      return createElement(
        IconContext.Provider,
        { value: { weight: 'regular' } },
        createElement(
          AutoHideScrollbars,
          null,
          createElement(AppQueryProvider, null, createElement(SessionChanges), Story()),
        ),
      )
    },
  ],
  globalTypes: {
    themeIdentity: {
      defaultValue: 'neutral',
      description: 'Color theme',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'neutral', title: 'Neutral' },
          { value: 'graphite', title: 'Graphite' },
        ],
      },
    },
    theme: {
      defaultValue: 'dark',
      description: 'Resolved appearance',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    // #2623: required, not a staged 'todo'. The suite was triaged clean under this grade before it
    // shipped, so a violation from here on is a real regression, not inherited debt.
    a11y: {
      test: 'error',
      options: {
        rules: {
          // Base UI's Popover/DropdownMenu portals render an `aria-hidden="true"` focus-guard
          // sentinel span (`data-base-ui-focus-guard`) to trap focus inside the open layer. It is
          // vendored, not app code, so this rule is exempted rather than chased into node_modules.
          'aria-hidden-focus': { enabled: false },
        },
      },
    },
    viewport: {
      options: {
        desktop: {
          name: 'Desktop 1200',
          styles: { width: '1200px', height: '800px' },
          type: 'desktop',
        },
        narrow: {
          name: 'Desktop 900',
          styles: { width: '900px', height: '800px' },
          type: 'desktop',
        },
        compact: {
          name: 'Desktop 680',
          styles: { width: '680px', height: '800px' },
          type: 'desktop',
        },
      },
    },
  },
}

export default preview
