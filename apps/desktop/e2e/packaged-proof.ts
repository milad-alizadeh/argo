// The fixtures every flow extends (#2326): one app per worker (`application-under-test.ts`), which nothing
// writes to, and a root per test, so each case builds its own state and runs alone, in any order.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test as base, type TestInfo } from '@playwright/test'
import type { BrowserContext, ElectronApplication, Page } from 'playwright-core'
import { applicationUnderTest } from './application-under-test'
import { FlowPerformanceProfile, performanceProfileEnabled } from './performance-profile'

export type PackagedProofFixtures = {
  // A temporary directory this test alone writes to, removed however the test ends.
  root: string
}

export type PackagedProofWorkerFixtures = {
  // The worker's app: the Vite build, or its packaged copy (`application-under-test.ts`).
  applicationUnderTest: string
  // The CPU recorder, on an opted-in run only: one trace per worker over every case it ran.
  performanceProfile: FlowPerformanceProfile | undefined
}

export const test = base.extend<PackagedProofFixtures, PackagedProofWorkerFixtures>({
  applicationUnderTest: [
    async ({}, use) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'argo-application-'))
      try {
        await use(await applicationUnderTest(root))
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
    { scope: 'worker' },
  ],
  performanceProfile: [
    async ({}, use, workerInfo) => {
      const profile = performanceProfileEnabled()
        ? new FlowPerformanceProfile(workerInfo.project.name, workerInfo.workerIndex)
        : undefined
      await use(profile)
      await profile?.write()
    },
    { scope: 'worker' },
  ],
  root: async ({}, use, testInfo) => {
    const root = await mkdtemp(path.join(os.tmpdir(), `argo-${testInfo.project.name}-`))
    try {
      await use(root)
    } finally {
      // A Harness still exiting can write its config backup mid-removal, so ENOTEMPTY retries.
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  },
})

export { expect } from '@playwright/test'

const TRACE = { screenshots: true, snapshots: true }

// Every launch calls this: `use.trace` never sees a window from `_electron.launch()`.
async function startTrace(application: ElectronApplication) {
  const context = application.context()
  await context.tracing.start(TRACE)
  return context
}

// Stops the launch's recording before it closes, and keeps it only when the test failed.
async function finishTrace(context: BrowserContext | undefined, testInfo: TestInfo) {
  if (!context) return
  // A case that closed its window without launching another leaves no recording to stop.
  if (testInfo.status === testInfo.expectedStatus) {
    await context.tracing.stop().catch(() => undefined)
    return
  }
  const tracePath = testInfo.outputPath('trace.zip')
  const stopped = await context.tracing.stop({ path: tracePath }).then(
    () => true,
    () => false,
  )
  if (stopped) await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' })
}

// What a launch records, one or the other: Playwright's screenshot trace and the CDP CPU trace both
// attach to the page, so a profiled run keeps only the samples and the timings it asked for. The
// trace covers the window's own creation, which is why the page it profiles arrives as a call.
export async function startRecording(
  profile: FlowPerformanceProfile | undefined,
  application: ElectronApplication,
  window: () => Promise<Page>,
) {
  if (!profile) return await startTrace(application)
  await profile.start(await window())
  return undefined
}

// Ends the case: its wall time on a profiled run, and otherwise the trace a failure keeps.
export async function finishRecording(
  profile: FlowPerformanceProfile | undefined,
  traced: BrowserContext | undefined,
  testInfo: TestInfo,
) {
  profile?.recordCase(testInfo)
  await finishTrace(traced, testInfo)
}
