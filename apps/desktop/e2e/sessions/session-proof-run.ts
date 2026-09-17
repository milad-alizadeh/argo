// Each Session case declares its state with `test.use` and launches against its own root (#2326).
import type { TestInfo } from '@playwright/test'
import type { BrowserContext } from 'playwright-core'
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { finishTrace, test as packagedTest, startTrace } from '../packaged-proof'
import { feedStateSnapshot } from './feed-selectors'
import { prepare } from './fixtures/feed.fixture'
import { JourneyPerformanceProfile, journeyProfileEnabled } from './journey-performance-profile'
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

type SessionWorkerFixtures = SessionBackendOptions & {
  journeyProfile: JourneyPerformanceProfile | undefined
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
export const test = packagedTest.extend<SessionFixtures, SessionWorkerFixtures>({
  sessionBackend: ['mock', { option: true, scope: 'worker' }],
  projectSelected: [true, { option: true }],
  slowReply: [false, { option: true }],
  adversarialSeed: [undefined, { option: true }],
  // One trace per worker holds every journey it ran, written when the worker ends.
  journeyProfile: [
    async ({}, use) => {
      const profile = journeyProfileEnabled() ? new JourneyPerformanceProfile() : undefined
      await use(profile)
      await profile?.write()
    },
    { scope: 'worker' },
  ],
  // Built per test, because a backend remembers the folders of the one root it started on.
  backend: async ({ sessionBackend }, use) => {
    await use(BACKENDS[sessionBackend]())
  },
  sessionFixture: async ({ root, packagedApplication, projectSelected }, use) => {
    await use(await prepare(root, packagedApplication, { projectSelected }))
  },
  session: async (
    { root, sessionFixture, backend, slowReply, adversarialSeed, journeyProfile },
    use,
    testInfo,
  ) => {
    let traced: BrowserContext | undefined
    const session = await createPackagedSessionHarness({
      root,
      fixture: sessionFixture,
      backend,
      launch: { slowReply, adversarialSeed },
      // Playwright's own screenshot trace and the CDP CPU trace both attach to the page, so a
      // profiled run skips the former and keeps only the timings and samples it asked for.
      launched: async (application, page) => {
        if (journeyProfile) await journeyProfile.start(page)
        else traced = await startTrace(application)
      },
      closing: async () => {
        await journeyProfile?.stop()
      },
    })
    try {
      await session.launch()
      if (!(await session.isPackaged())) throw new Error('The case did not drive the packaged app.')
      await use(session)
      journeyProfile?.recordCase(testInfo)
      await finishTrace(traced, testInfo)
      if (testInfo.status !== testInfo.expectedStatus) await attachFailure(session, testInfo)
    } finally {
      await journeyProfile?.stop()
      await session.close()
    }
  },
})

export { expect } from '../packaged-proof'
