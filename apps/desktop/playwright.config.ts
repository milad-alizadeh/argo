import { defineConfig } from '@playwright/test'

// The packaged Session proofs (#2325): `.spec.ts` only, never the `.test.ts` files beside them,
// which run on `bun:test`. Each spec file is one packaged launch shared serially across its own
// cases (`session-proof-run.ts`), so nothing here runs in parallel and a failure stops that file.
//
// No `use.trace` here: that option only auto-instruments a context this runner creates through its
// own `context`/`page` fixtures. The Electron window under proof comes from `_electron.launch()`
// instead, which this runner never sees, so `session-proof-run.ts` drives `context.tracing`
// directly and turns it on for every test, keeping the trace only on a failure.
export default defineConfig({
  testDir: 'src/core/sessions/fake-driver',
  testMatch: /\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // A case that restarts the app pays the harness's own 30s launch budget on top of its own
  // waits (`packaged-session-harness.ts:15`), so the per-test ceiling gives it double that.
  timeout: 60_000,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'line',
  outputDir: 'test-results',
})
