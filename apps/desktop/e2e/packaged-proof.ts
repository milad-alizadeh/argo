// One serial describe per packaged flow: a temp root removed however the run ends, and a trace per failed test.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestInfo, TestType } from '@playwright/test'
import type { BrowserContext, ElectronApplication } from 'playwright-core'

export type PackagedProof = {
  readonly root: string
  // Runs once the root exists. A flow that needs a fixture registers its own `test.beforeAll` instead.
  setup: (work: () => Promise<void>) => void
  // Runs before the root is removed.
  teardown: (work: () => Promise<void>) => void
  // Every launch calls this: `use.trace` never sees a window from `_electron.launch()`.
  trace: (application: ElectronApplication) => Promise<void>
  // Attaches more evidence to a failed test.
  onFailure: (work: (testInfo: TestInfo) => Promise<void>) => void
}

const TRACE = { screenshots: true, snapshots: true }

export function describePackagedProof<Tests extends object, Workers extends object>(
  test: TestType<Tests, Workers>,
  name: string,
  body: (proof: PackagedProof) => void,
) {
  test.describe
    .serial(name, () => {
      let root = ''
      let traced: BrowserContext | undefined
      const failures: Array<(testInfo: TestInfo) => Promise<void>> = []

      test.beforeAll(async () => {
        root = await mkdtemp(path.join(os.tmpdir(), `argo-${name.replaceAll(' ', '-')}-`))
      })

      // A test that closed its window without launching another leaves no recording to stop.
      test.afterEach(async ({}, testInfo) => {
        const context = traced
        if (!context) return
        if (testInfo.status === testInfo.expectedStatus) {
          await context.tracing.stop()
        } else {
          const tracePath = testInfo.outputPath('trace.zip')
          await context.tracing.stop({ path: tracePath })
          await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' })
          for (const attach of failures) await attach(testInfo)
        }
        await context.tracing.start(TRACE)
      })

      body({
        get root() {
          return root
        },
        setup: (work) => test.beforeAll(work),
        teardown: (work) => test.afterAll(work),
        trace: async (application) => {
          traced = application.context()
          application.on('close', () => {
            if (traced === application.context()) traced = undefined
          })
          await traced.tracing.start(TRACE)
        },
        onFailure: (work) => failures.push(work),
      })

      test.afterAll(async () => {
        if (root) await rm(root, { recursive: true, force: true })
      })
    })
}
