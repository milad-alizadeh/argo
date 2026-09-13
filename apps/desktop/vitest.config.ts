import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const directory = path.dirname(fileURLToPath(import.meta.url))

// One story run per theme, so a component that only breaks in light theme fails CI.
function storybookProject(theme: 'dark' | 'light') {
  return {
    extends: true as const,
    plugins: [
      storybookTest({
        configDir: path.join(directory, '.storybook'),
        initialGlobals: { theme },
      }),
    ],
    test: {
      name: `storybook-${theme}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright({}),
        instances: [{ browser: 'chromium' as const }],
      },
    },
  }
}

export default defineConfig({
  optimizeDeps: {
    include: ['@storybook/react-dom-shim', 'react/jsx-dev-runtime'],
  },
  test: {
    projects: [storybookProject('dark'), storybookProject('light')],
  },
})
