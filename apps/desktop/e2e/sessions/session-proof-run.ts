// Each Session case declares its state with `test.use` and launches against its own root (#2326).
import type { TestInfo } from '@playwright/test'
import type { BrowserContext } from 'playwright-core'
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { finishRecording, test as packagedTest, startRecording } from '../packaged-proof'
import { feedStateSnapshot } from './feed-selectors'
import { prepare } from './fixtures/feed.fixture'
import { createPackagedSessionHarness, type PackagedSession } from './packaged-session-harness'
import { createRealSessionCliBackend } from './real-cli/real-session-cli-backend'
import type { SessionBackendOptions } from './session-backend-option'
import type { SessionCliBackend, SessionFixture } from './session-cli-backend'

const BACKENDS = {
  mock: createMockSessionCliBackend,
  real: createRealSessionCliBackend,
} satisfies Record<SessionBackendOptions['sessionBackend'], () => SessionCliBackend>

export type SessionOptions = {
  // The Roster shows only for a selected Project (#2307), so every case but the empty-window one wants it.
  projectSelected: boolean
  // A CLI that holds its reply, so a case can read the app waiting on a Turn (#2119).
  slowReply: boolean
  // Replays the mock CLI's seeded jitter, split bytes and failures.
  adversarialSeed: string | undefined
}

export type SessionFixtures = SessionOptions & {
  backend: SessionCliBackend
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
  sessionFixture: async ({ root, packagedApplication, projectSelected }, use) => {
    await use(await prepare(root, packagedApplication, { projectSelected }))
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
        traced = await startRecording(performanceProfile, application, page)
      },
      closing: async () => {
        await performanceProfile?.stop()
      },
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
