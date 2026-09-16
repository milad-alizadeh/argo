import { defineConfig } from '@playwright/test'

// The packaged e2e flows (#2325), one project per flow under `e2e/`: `bun run test:e2e` runs them
// all, and `-- --project=sessions` or a file path narrows the run. Each `*.e2e.ts` file is one
// packaged launch shared serially across its own cases, so nothing here runs in parallel.
//
// No `use.trace` here: that option only auto-instruments a context this runner creates through its
// own `context`/`page` fixtures. The Electron window under proof comes from `_electron.launch()`
// instead, which this runner never sees, so `e2e/sessions/session-proof-run.ts` drives
// `context.tracing` directly and keeps the trace only on a failure.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // A case that restarts the app pays the harness's own 30s launch budget on top of its own
  // waits (`e2e/sessions/packaged-session-harness.ts`), so the per-test ceiling gives it double.
  timeout: 60_000,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'line',
  outputDir: 'test-results',
  projects: [
    { name: 'projects', testDir: 'e2e/projects' },
    { name: 'sessions', testDir: 'e2e/sessions' },
    { name: 'tickets', testDir: 'e2e/tickets' },
    // Signed-in local CLIs only, never CI: `bun run e2e:real` sets the variable. A reply can take
    // the real backend's whole 180s budget, so a case gets more than that.
    ...(process.env.ARGO_E2E_REAL === '1'
      ? [{ name: 'real-sessions', testDir: 'e2e/real-sessions', timeout: 240_000 }]
      : []),
  ],
})
