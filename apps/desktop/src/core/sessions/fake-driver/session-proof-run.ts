// The scaffolding every packaged Session spec file shares (#2308, #2325): a fixture root that is
// removed however the run ends, a harness on one CLI backend, and a trace recording segmented at
// every test boundary. A spec file is then its case list and nothing else.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from '@playwright/test'
import type { Page } from 'playwright-core'
import { feedStateSnapshot } from './feed-selectors'
import { createPackagedSessionHarness } from './packaged-session-harness'
import type { SessionCliBackend, SessionFixture } from './session-cli-backend'

type Harness = Awaited<ReturnType<typeof createPackagedSessionHarness>>

export type SessionProofRun = {
  readonly root: string
  readonly fixture: SessionFixture
  launch: Harness['launch']
  restart: Harness['restart']
  isPackaged: Harness['isPackaged']
  // Records the page the current case is driving, so a failure's trace and console dump report
  // that window rather than the one the run opened with.
  hold: (page: Page) => Page
}

// The page the journeys are currently driving, read and written by name so a case that restarts
// the app (`session-claude-resume`, `session-codex-resume`, the slow-reply restart below) hands
// the next case the window it actually has to keep.
export type PageBox = { get: () => Page; set: (page: Page) => Page }

// Both spec files build one of these right after `describeSessionProof` hands them a run, so the
// box itself stays out of each file's own duplicated setup (#2325).
export function createPageBox(hold: SessionProofRun['hold']): PageBox {
  let page: Page
  return {
    get: () => page,
    set: (next) => {
      page = next
      return hold(next)
    },
  }
}

// Wraps a packaged Session spec file in one serial describe block: one fixture root and one
// harness, on one CLI backend, shared across every case the way a packaged launch's cost demands
// (`packaged-session-harness.ts:34-42`). Playwright still gives each case its own test: a failure
// reports one name, and every later test in the file is skipped rather than run against state a
// prior failure left inconsistent.
export function describeSessionProof(
  name: string,
  backend: SessionCliBackend,
  body: (run: SessionProofRun) => void,
) {
  test.describe
    .serial(name, () => {
      let root: string
      let harness: Harness
      let page: Page | undefined

      test.beforeAll(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), `argo-${name}-`))
        harness = await createPackagedSessionHarness(root, backend)
      })

      test.afterAll(async () => {
        await harness?.close()
        await rm(root, { recursive: true, force: true })
      })

      test.afterEach(async ({}, testInfo) => {
        const context = harness.context()
        if (!context) return
        const failed = testInfo.status !== testInfo.expectedStatus
        if (!failed) {
          await context.tracing.stop()
        } else {
          const tracePath = testInfo.outputPath('trace.zip')
          await context.tracing.stop({ path: tracePath })
          await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' })
          await testInfo.attach('feed-state', {
            body: JSON.stringify(
              await feedStateSnapshot(page).catch((error: unknown) => ({
                snapshotFailed: String(error),
              })),
            ),
            contentType: 'application/json',
          })
          await testInfo.attach('renderer-console', {
            body: harness.recentConsole().join('\n'),
            contentType: 'text/plain',
          })
        }
        // A restart already opened a fresh recording (`packaged-session-harness.ts`); a context
        // that ran unrestarted needs one for the next test.
        await harness.context()?.tracing.start({ screenshots: true, snapshots: true })
      })

      // `harness` is only assigned once `beforeAll` runs; every member below reads it lazily, at
      // case-execution time, rather than capturing it at this describe-registration time.
      body({
        get root() {
          return root
        },
        get fixture() {
          return harness.fixture
        },
        launch: (...arguments_) => harness.launch(...arguments_),
        restart: (...arguments_) => harness.restart(...arguments_),
        isPackaged: () => harness.isPackaged(),
        hold: (next) => {
          page = next
          return next
        },
      })
    })
}
