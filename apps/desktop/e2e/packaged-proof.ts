// The fixtures every packaged flow extends (#2326): one fuse-flipped app copy per worker, which nothing
// writes to, and a root per test, so each case builds its own state and runs alone, in any order.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test as base, type TestInfo } from '@playwright/test'
import type { BrowserContext, ElectronApplication } from 'playwright-core'
import { packagedTestCopy } from './packaged-app'

export type PackagedProofFixtures = {
  // A temporary directory this test alone writes to, removed however the test ends.
  root: string
}

export type PackagedProofWorkerFixtures = {
  // The worker's packaged app copy.
  packagedApplication: string
}

export const test = base.extend<PackagedProofFixtures, PackagedProofWorkerFixtures>({
  packagedApplication: [
    async ({}, use) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-app-'))
      try {
        await use(await packagedTestCopy(root))
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
    { scope: 'worker' },
  ],
  root: async ({}, use, testInfo) => {
    const root = await mkdtemp(path.join(os.tmpdir(), `argo-${testInfo.project.name}-`))
    try {
      await use(root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
})

export { expect } from '@playwright/test'

const TRACE = { screenshots: true, snapshots: true }

// Every launch calls this: `use.trace` never sees a window from `_electron.launch()`.
export async function startTrace(application: ElectronApplication) {
  const context = application.context()
  await context.tracing.start(TRACE)
  return context
}

// Stops the launch's recording before it closes, and keeps it only when the test failed.
export async function finishTrace(context: BrowserContext | undefined, testInfo: TestInfo) {
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
