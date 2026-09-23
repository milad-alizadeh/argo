// Each Session case declares its state with `test.use` and launches against its own root (#2326).
import type { TestInfo } from '@playwright/test'
import type { BrowserContext } from 'playwright-core'
import { createMockSessionHarnessBackend } from '../../mocks/sessions/mock-session-harness-backend'
import { finishRecording, test as packagedTest, startRecording } from '../packaged-proof'
import { feedStateSnapshot } from './feed-selectors'
import { prepare } from './fixtures/feed.fixture'
import { createPackagedSessionHarness, type PackagedSession } from './packaged-session-harness'
import { createRealSessionHarnessBackend } from './real-harness/real-session-harness-backend'
import type { SessionBackendOptions } from './session-backend-option'
import type { SessionFixture, SessionHarnessBackend } from './session-harness-backend'

const BACKENDS = {
  mock: createMockSessionHarnessBackend,
  real: createRealSessionHarnessBackend,
} satisfies Record<SessionBackendOptions['sessionBackend'], () => SessionHarnessBackend>

export type SessionOptions = {
  // The Roster shows only for a selected Project (#2307), so every case but the empty-window one wants it.
  projectSelected: boolean
  // A Harness that holds its reply, so a case can read the app waiting on a Turn (#2119).
  slowReply: boolean
  // Replays the mock Harness's seeded jitter, split bytes and failures.
  adversarialSeed: string | undefined
}

export type SessionFixtures = SessionOptions & {
  backend: SessionHarnessBackend
  sessionFixture: SessionFixture
  session: PackagedSession
}

async function attachFailure(session: PackagedSession, testInfo: TestInfo) {
  const snapshot = await feedStateSnapshot(session.page()).catch((error: unknown) => ({
    snapshotFailed: String(error),
  }))
  await testInfo.attach('feed-state', {
    body: JSON.stringify(snapshot),
    contentType: 'application/json',
  })
  await testInfo.attach('renderer-console', {
    body: session.recentConsole().join('\n'),
    contentType: 'text/plain',
  })
}

// `real` drives the signed-in local CLIs, so only the opt-in `real-sessions` project sets it.
export const test = packagedTest.extend<SessionFixtures, SessionBackendOptions>({
  sessionBackend: ['mock', { option: true, scope: 'worker' }],
  projectSelected: [true, { option: true }],
  slowReply: [false, { option: true }],
  adversarialSeed: [undefined, { option: true }],
  // Built per test, because a backend remembers the folders of the one root it started on.
  backend: async ({ sessionBackend }, use) => {
    await use(BACKENDS[sessionBackend]())
  },
  sessionFixture: async ({ root, packagedApplication, projectSelected, setupDocument }, use) => {
    await use(await prepare(root, packagedApplication, { projectSelected, setupDocument }))
  },
  session: async (
    { root, sessionFixture, backend, slowReply, adversarialSeed, performanceProfile },
    use,
    testInfo,
  ) => {
    let traced: BrowserContext | undefined
    const session = await createPackagedSessionHarness({
      root,
      fixture: sessionFixture,
      backend,
      launch: { slowReply, adversarialSeed },
      launched: async (application, page) => {
        traced = await startRecording(performanceProfile, application, async () => page)
      },
      closing: async () => {
        await performanceProfile?.stop()
      },
      videoDir: process.env.ARGO_E2E_VIDEO === '1' ? testInfo.outputPath('video') : undefined,
    })
    try {
      await session.launch()
      if (!(await session.isPackaged())) throw new Error('The case did not drive the packaged app.')
      await use(session)
      await finishRecording(performanceProfile, traced, testInfo)
      if (testInfo.status !== testInfo.expectedStatus) await attachFailure(session, testInfo)
    } finally {
      await performanceProfile?.stop()
      await session.close()
    }
  },
})

export { expect } from '../packaged-proof'
