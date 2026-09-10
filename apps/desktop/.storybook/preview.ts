import type { Preview } from '@storybook/react'

import '../src/renderer/i18n/config'
import '../src/renderer/styles/globals.css'

// The Feed keys its measure pass on the window's zoom, read off the preload bridge
// (`feed/measure.ts`). A story has no preload, so the one call it reaches is answered here with
// the zoom a story is drawn at.
const host = window as unknown as { argo?: Record<string, unknown> }
host.argo = { ...host.argo, zoomFactor: () => 1 }

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
}

export default preview
