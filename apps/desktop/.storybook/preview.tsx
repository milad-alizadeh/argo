import type { Preview } from '@storybook/react-vite'
import { createElement, type ReactElement } from 'react'
import { themes } from 'storybook/theming'
import '../src/renderer/src/styles/globals.css'

// The Cockpit is dark-first — index.html sets `class="dark"` on <html>, so do the same to
// the preview iframe's document rather than to a wrapper inside it. globals.css paints
// `body` with `bg-background`, and only the root element can put that in dark mode: with
// the class on a decorator, the body underneath stayed light and flashed white on every
// navigation, before the story's own dark box painted over it.
document.documentElement.classList.add('dark')

const preview: Preview = {
  // Docs for every component without a per-file opt-in — the props table is generated from
  // the TSDoc on each component's props type, so that is where a prop is documented.
  tags: ['autodocs'],

  // Layout only — the background now comes from the document, as it does in the app.
  // Authored with createElement rather than JSX because Storybook config is type-checked
  // under the node tsconfig (no jsx flag). A docs page stacks one of these per story, so
  // the canvas-filling height belongs to the story view only — in docs it would push the
  // props table a screen down per story.
  decorators: [
    (Story, context): ReactElement =>
      createElement(
        'div',
        {
          className:
            context.viewMode === 'docs'
              ? 'flex items-center justify-center p-region'
              : 'flex min-h-screen items-center justify-center',
        },
        createElement(Story),
      ),
  ],
  parameters: {
    // The dark theme has to be set twice because they are two different surfaces:
    // manager.ts themes the Storybook chrome (sidebar, toolbar), while this themes the
    // generated docs page, which renders inside the preview iframe the chrome cannot reach.
    docs: { theme: themes.dark },

    // Let the decorator fill the whole canvas (it centres the story itself) instead of
    // shrink-wrapping the component into Storybook's default padded, white-backed box.
    layout: 'fullscreen',

    // The backgrounds addon paints its own swatch (its "dark" is #333) over the canvas,
    // which is lighter than --background and makes every story lie about its contrast.
    // The cockpit has ONE background and it comes from the token contract, so the toolbar
    // toggle is removed rather than re-pointed at a value that would then need keeping.
    backgrounds: { disable: true },
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
