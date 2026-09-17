import { defineConfig } from '@playwright/test'
import type { SessionBackendOptions } from './e2e/sessions/session-backend-option'

// One project per flow under `e2e/` (#2325). Every case launches the packaged app against its own
// root (`e2e/packaged-proof.ts`, #2326), so cases run in parallel, one app per worker.
export default defineConfig<object, SessionBackendOptions>({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  // The default, half the cores, is one worker on the 3-core macOS runner; locally 1 took 130s, 3 took 61s.
  workers: 3,
  // The retry records a second trace, and a test that passes only on the retry still fails CI.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  // A case that restarts the app pays the harness's 30s launch budget on top of its own waits.
  timeout: 60_000,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'line',
  outputDir: 'test-results',
  projects: [
    { name: 'projects', testDir: 'e2e/projects' },
    {
      name: 'sessions',
      testDir: 'e2e/sessions',
      testIgnore: '**/adversarial.e2e.ts',
    },
    { name: 'tickets', testDir: 'e2e/tickets' },
    ...(process.env.ARGO_E2E_ADVERSARIAL === '1'
      ? [
          {
            name: 'sessions-adversarial',
            testDir: 'e2e/sessions',
            testMatch: '**/adversarial.e2e.ts',
          },
        ]
      : []),
    // The signed-in local CLIs, never CI. A real reply can take the backend's whole 180s budget.
    ...(process.env.ARGO_E2E_REAL === '1'
      ? [
          {
            name: 'real-sessions',
            testDir: 'e2e/sessions',
            testMatch: 'journeys.e2e.ts',
            // One real Turn at a time, so the subscriptions see one person's pace.
            fullyParallel: false,
            timeout: 240_000,
            use: { sessionBackend: 'real' as const },
          },
        ]
      : []),
  ],
})
