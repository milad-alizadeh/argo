import { IconContext } from '@phosphor-icons/react'
import type { Preview } from '@storybook/react-vite'
import { createElement } from 'react'
import { useEffect } from 'storybook/preview-api'
import { storyPreloads } from '../mocks/platform/story-preload'
import { SessionChanges } from '../src/domains/sessions/renderer'
import { AppQueryProvider } from '../src/platform/renderer/app-query-provider'
import { AutoHideScrollbars } from '../src/platform/renderer/auto-hide-scrollbars'
import '../src/renderer/i18n'
import '../src/platform/renderer/styles/globals.css'
import {
  APPEARANCES,
  type AppearanceState,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME,
  THEMES,
} from '../src/platform/contract/appearance'
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
      const systemAppearance = window.matchMedia('(prefers-color-scheme: dark)')
      const appearance =
        APPEARANCES.find((candidate) => candidate === context.globals.theme) ?? DEFAULT_APPEARANCE
      const theme =
        THEMES.find((candidate) => candidate === context.globals.themeIdentity) ?? DEFAULT_THEME
      let state: AppearanceState = {
        theme,
        appearance,
        dark: appearance === 'system' ? systemAppearance.matches : appearance === 'dark',
        revision: ++appearanceRevision,
      }
      applyAppearance(state)
      host.argo = {
        ...host.argo,
        getAppearance: () => Promise.resolve(state),
        setAppearance: async (preference) => {
          state = {
            ...preference,
            dark:
              preference.appearance === 'system'
                ? systemAppearance.matches
                : preference.appearance === 'dark',
            revision: ++appearanceRevision,
          }
          applyAppearance(state)
          return { ok: true, state }
        },
      } as typeof host.argo
      useEffect(() => {
        const updated = () => {
          if (state.appearance !== 'system' || state.dark === systemAppearance.matches) return
          state = { ...state, dark: systemAppearance.matches, revision: ++appearanceRevision }
          applyAppearance(state)
        }
        systemAppearance.addEventListener('change', updated)
        return () => systemAppearance.removeEventListener('change', updated)
      }, [systemAppearance, state])
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
      name: 'Theme',
      defaultValue: DEFAULT_THEME,
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'catppuccin', title: 'Catppuccin' },
          { value: 'ocean-breeze', title: 'Ocean Breeze' },
          { value: 'northern-lights', title: 'Northern Lights' },
        ],
      },
    },
    theme: {
      name: 'Mode',
      defaultValue: 'dark',
      description: 'Color mode',
      toolbar: {
        title: 'Mode',
        icon: 'paintbrush',
        items: [
          { value: 'system', title: 'System' },
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
