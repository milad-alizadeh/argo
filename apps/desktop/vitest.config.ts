import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// Two projects (see https://storybook.js.org/docs/writing-tests/integrations/vitest-addon):
//  - unit: plain node tests for renderer/main logic (fast, deterministic).
//  - storybook: every story run as a test in a real Chromium via Playwright — the
//    component/story-testing surface (ADR-0006).
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        resolve: {
          alias: {
            '@': path.join(dirname, 'src/renderer/src'),
            '@shared': path.join(dirname, 'src/shared/index.ts'),
          },
        },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        // Pre-bundle the React + Storybook render deps so Vite's optimizer settles
        // before the browser tests run. Without this it discovers them lazily and
        // reloads mid-test ("Vite unexpectedly reloaded a test"), which 404s the
        // in-flight dynamic import of @storybook/react-dom-shim.
        optimizeDeps: {
          include: [
            'react',
            'react/jsx-runtime',
            'react/jsx-dev-runtime',
            'react-dom',
            'react-dom/client',
          ],
        },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
