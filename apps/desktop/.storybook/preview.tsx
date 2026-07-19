import type { Preview } from '@storybook/react-vite'
import { createElement, type ReactElement } from 'react'
import '../src/renderer/src/styles/globals.css'

const preview: Preview = {
  // The Cockpit is dark-first (index.html sets <html class="dark">); mirror that in
  // Storybook so components render against the same tokens they ship with. Authored with
  // createElement rather than JSX because Storybook config is type-checked under the node
  // tsconfig (no jsx flag).
  decorators: [
    (Story): ReactElement =>
      createElement(
        'div',
        { className: 'dark bg-background text-foreground' },
        createElement(Story),
      ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
}

export default preview
