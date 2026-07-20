import type { Preview } from '@storybook/react-vite'
import { createElement, type ReactElement } from 'react'
import { themes } from 'storybook/theming'
import '../src/renderer/src/styles/globals.css'

const preview: Preview = {
  // Docs for every component without a per-file opt-in — the props table is generated from
  // the TSDoc on each component's props type, so that is where a prop is documented.
  tags: ['autodocs'],

  // The Cockpit is dark-first (index.html sets <html class="dark">); mirror that in
  // Storybook so components render against the same tokens they ship with. Authored with
  // createElement rather than JSX because Storybook config is type-checked under the node
  // tsconfig (no jsx flag).
  // A docs page stacks one of these per story, so the canvas-filling height belongs to the
  // story view only — in docs it would push the props table a screen down per story.
  decorators: [
    (Story, context): ReactElement =>
      createElement(
        'div',
        {
          className:
            context.viewMode === 'docs'
              ? 'dark bg-background text-foreground flex items-center justify-center p-region'
              : 'dark bg-background text-foreground flex min-h-screen items-center justify-center',
        },
        createElement(Story),
      ),
  ],
  parameters: {
    // The dark theme has to be set twice because they are two different surfaces:
    // manager.ts themes the Storybook chrome (sidebar, toolbar), while this themes the
    // generated docs page, which renders inside the preview iframe the chrome cannot reach.
    docs: { theme: themes.dark },

    // Let the dark decorator fill the whole canvas (it centres the story itself) instead
    // of shrink-wrapping the component into a dark box on Storybook's default white.
    layout: 'fullscreen',
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
