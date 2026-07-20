import type { Preview } from '@storybook/react-vite'
import { createElement, type ReactElement } from 'react'
import { themes } from 'storybook/theming'
import '../src/renderer/src/styles/globals.css'

// globals.css paints `body` with `bg-background`, and only the root element can put that
// in dark mode — on a decorator instead, the body stays light and flashes white on every
// navigation. index.html does the same.
document.documentElement.classList.add('dark')

const preview: Preview = {
  // The props table is generated from the TSDoc on each component's props type, so that is
  // where a prop is documented.
  tags: ['autodocs'],

  // createElement rather than JSX because Storybook config is type-checked under the node
  // tsconfig (no jsx flag). A docs page stacks one wrapper per story, so the
  // canvas-filling height belongs to the story view only.
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
    // Set twice because they are two surfaces: manager.ts themes the Storybook chrome,
    // this themes the generated docs page inside the preview iframe.
    docs: { theme: themes.dark },

    // Let the decorator fill the whole canvas instead of Storybook's padded, white-backed box.
    layout: 'fullscreen',

    // The two signpost pages are what a newcomer should meet first; alphabetical order
    // would file them under the component tree instead.
    options: { storySort: { order: ['Overview', 'Foundations', '*'] } },

    // The addon paints its own swatch (a lighter gray than --background) over the canvas,
    // making every story lie about its contrast. The cockpit has ONE background and it
    // comes from the token contract, so the toggle is removed rather than re-pointed.
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // 'todo' surfaces violations in the test UI without failing CI ('error' would).
    a11y: { test: 'todo' },
  },
}

export default preview
