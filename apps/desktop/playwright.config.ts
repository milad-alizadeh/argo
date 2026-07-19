import { defineConfig } from '@playwright/test'

/**
 * App-launch smokes only (ADR-0006): Playwright boots the real Electron app via
 * its `_electron` launcher to exercise the main process, IPC, and window — a
 * boundary Storybook/browser-mode can't reach. No browser `projects` here; the
 * tests drive Electron directly. Component/story tests live in Vitest browser mode.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list']] : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
})
