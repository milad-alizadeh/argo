import type { Preview } from '@storybook/react-vite'
import { createElement } from 'react'

import { AppQueryProvider } from '../src/platform/renderer/app-query-provider'
import '../src/renderer/i18n'
import '../src/platform/renderer/styles/globals.css'
import { host } from './storybook-host'

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === 'dark'
      host.argo = {
        ...host.argo,
        getAppearance: () => Promise.resolve({ appearance: dark ? 'dark' : 'light', dark }),
      } as typeof host.argo
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
      return createElement(AppQueryProvider, null, Story())
    },
  ],
  globalTypes: {
    theme: {
      defaultValue: 'dark',
      description: 'Cockpit appearance',
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
