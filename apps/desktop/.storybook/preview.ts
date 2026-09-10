import type { Preview } from '@storybook/react'

import '../src/renderer/tokens.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
}

export default preview
