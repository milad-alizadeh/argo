// A flow's own `test.extend` fixture, built on the base packaged-app fixtures: launch the app,
// wait for the preload surface it depends on, hand the window to the case, then unwind in order.

import type { TestInfo } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright-core'
import type { PackagedProofFixtures, PackagedProofWorkerFixtures } from './packaged-proof'
import { finishRecording, startRecording } from './packaged-proof'
import type { FlowPerformanceProfile } from './performance-profile'

type PackagedRunOf<Fixture> = { application: ElectronApplication; page: Page; fixture: Fixture }

async function launchPackagedRun<Fixture>(params: {
  application: ElectronApplication
  fixture: Fixture
  performanceProfile: FlowPerformanceProfile | undefined
  ready: (page: Page) => Promise<unknown>
  use: (value: PackagedRunOf<Fixture>) => Promise<void>
  testInfo: TestInfo
}) {
  const { application, fixture, performanceProfile, ready, use, testInfo } = params
  try {
    const traced = await startRecording(performanceProfile, application, () =>
      application.firstWindow(),
    )
    const page = await application.firstWindow()
    page.setDefaultTimeout(30_000)
    await ready(page)
    await use({ application, page, fixture })
    await finishRecording(performanceProfile, traced, testInfo)
  } finally {
    await performanceProfile?.stop()
    await application.close()
  }
}

// A flow's `test.extend` fixture: prepare the flow's own state, launch its app, and wait for the
// one preload surface the flow needs before handing the window to the case.
export function packagedFixture<Fixture>(
  prepare: (root: string, packagedApplication: string) => Promise<Fixture>,
  launch: (fixture: Fixture) => Promise<ElectronApplication>,
  ready: (page: Page) => Promise<unknown>,
) {
  return async (
    {
      root,
      packagedApplication,
      performanceProfile,
    }: Pick<
      PackagedProofFixtures & PackagedProofWorkerFixtures,
      'root' | 'packagedApplication' | 'performanceProfile'
    >,
    use: (value: PackagedRunOf<Fixture>) => Promise<void>,
    testInfo: TestInfo,
  ) => {
    const fixture = await prepare(root, packagedApplication)
    const application = await launch(fixture)
    await launchPackagedRun<Fixture>({
      application,
      fixture,
      performanceProfile,
      ready,
      use,
      testInfo,
    })
  }
}
