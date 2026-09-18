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

// Bun runs every other suite here, but Bun 1.3.14 ships no `node:sqlite`, so the Session index
// and everything read through it run on Node instead. `*.vitest.ts` is that role's one suffix,
// and Bun's own matcher never claims it.
const nodeProject = {
  extends: true as const,
  resolve: { alias: { '@': path.join(directory, 'src') } },
  test: { name: 'node', environment: 'node' as const, include: ['src/**/*.vitest.ts'] },
}

export default defineConfig({
  optimizeDeps: {
    include: ['@storybook/react-dom-shim', 'react/jsx-dev-runtime'],
  },
  test: {
    projects: [nodeProject, storybookProject('dark'), storybookProject('light')],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: 'coverage/storybook',
      include: ['src/renderer/**'],
      // Vendored shadcn components, not code this repo authors or tests directly.
      exclude: ['src/renderer/components/ui/**'],
    },
  },
})
