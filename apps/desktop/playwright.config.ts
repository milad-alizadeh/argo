import { defineConfig } from '@playwright/test'
import type { SessionBackendOptions } from './e2e/sessions/session-backend-option'

// One project per flow under `e2e/` (#2325). Every case launches the packaged app against its own
// root (`e2e/packaged-proof.ts`, #2326), so cases run in parallel, one app per worker.
export default defineConfig<object, SessionBackendOptions>({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  // A recorded video (electron.launch's recordVideo, wired per case) lives only in a passing
  // test's own outputDir, which Playwright otherwise deletes on success.
  preserveOutput: 'always',
  // Full width (3 on the 3-core macOS runner) leaves no core free for a worker's own app-server
  // child process, so three Electron apps and their spawns fight for three cores and whichever
  // one is scheduled last hits its timeout. CI keeps one core free; locally 1 took 130s, 3 took 61s.
  workers: process.env.CI ? 2 : 3,
  // The retry records a second trace, and a test that passes only on the retry still fails CI.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  // A handful of genuinely broken cases means a broken fixture, not 61 unrelated flakes, so CI
  // stops there instead of paying every remaining case's retry budget to learn what it already knows.
  maxFailures: process.env.CI ? 5 : undefined,
  // A case that restarts the app pays the harness's 30s launch budget on top of its own waits.
  timeout: 60_000,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'line',
  outputDir: 'test-results',
  // One shard, or the whole suite, is chosen by `--shard` on the CLI (#2605); the config lists
  // every project unconditionally so a shard's slice is drawn from the full case set.
  projects: [
    { name: 'project-setup', testDir: 'e2e/project-setup' },
    { name: 'projects', testDir: 'e2e/projects' },
    { name: 'harness-signin', testDir: 'e2e/harness-signin' },
    { name: 'project-workspaces', testDir: 'e2e/project-workspaces' },
    // The adversarial cases (jitter, split bytes, stalls, seeded failure) run inside this same
    // project and the same `test:e2e` invocation, not a second `turbo run` (#2605): one packaged
    // app boot and one Playwright startup covers both.
    { name: 'sessions', testDir: 'e2e/sessions' },
    { name: 'tickets', testDir: 'e2e/tickets' },
    // The signed-in local CLIs, never CI. A real reply can take the backend's whole 180s budget.
    // Same file as `sessions`, `sessionBackend` is the only difference (#e2e-real-cheap-models):
    // a case that never drives a live Turn just passes again, and one that does gets the real CLI.
    ...(process.env.ARGO_E2E_REAL === '1'
      ? [
          {
            name: 'real-sessions',
            testDir: 'e2e/sessions',
            testMatch: 'feed.e2e.ts',
            grep: /session-sdk-history-real|session-feed-transcript-corpus/,
            // One real Turn at a time, so the subscriptions see one person's pace.
            fullyParallel: false,
            timeout: 240_000,
            use: { sessionBackend: 'real' as const },
          },
        ]
      : []),
  ],
})
