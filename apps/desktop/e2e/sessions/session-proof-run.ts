// Each Session case declares its state with `test.use` and launches against its own root (#2326).
import type { TestInfo } from '@playwright/test'
import type { BrowserContext, Page } from 'playwright-core'
import { createMockSessionHarnessBackend } from '../../mocks/sessions/mock-session-harness-backend'
import { packagedRun } from '../application-under-test'
import { finishRecording, test as packagedTest, startRecording } from '../packaged-proof'
import { feedStateSnapshot } from './feed-selectors'
import { fixtureSession, readFixtureSessionsFrom } from './fixture-sessions'
import { ARCHIVED_FIXTURES, CODEX_FIXTURES, FIXTURES, prepare } from './fixtures/feed.fixture'
import { createPackagedSessionHarness, type PackagedSession } from './packaged-session-harness'
import { sendSessionUpdate } from './page-trpc'
import { createRealSessionHarnessBackend } from './real-harness/real-session-harness-backend'
import type { SessionBackendOptions } from './session-backend-option'
import type { SessionFixture, SessionHarnessBackend } from './session-harness-backend'

const BACKENDS = {
  mock: createMockSessionHarnessBackend,
  real: createRealSessionHarnessBackend,
} satisfies Record<SessionBackendOptions['sessionBackend'], () => SessionHarnessBackend>

export type SessionOptions = {
  // The Session List shows only for a selected Project (#2307), so every case but the empty-window one wants it.
  projectSelected: boolean
  // A Harness that holds its reply, so a case can read the app waiting on a Turn (#2119).
  slowReply: boolean
  // Replays the mock Harness's seeded jitter, split bytes and failures.
  adversarialSeed: string | undefined
  sessionSyncFixture: { records: unknown[] } | undefined
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

// Codex lists its threads after Claude, so a case waits for every listed fixture before it reads the Session List.
const LISTED_FIXTURES = [
  ...FIXTURES.filter((name) => name !== 'unparseableBody'),
  ...CODEX_FIXTURES,
]

// The reader archived these before the case begins, through the call the Session List's Archive makes.
async function archiveFixtures(page: Page) {
  await Promise.all(LISTED_FIXTURES.map(fixtureSession))
  const sessionIds = await Promise.all(ARCHIVED_FIXTURES.map(fixtureSession))
  const archived = await sendSessionUpdate(page, { sessionIds, archived: true })
  const failed = sessionIds.filter((id) => !archived.sessionIds.includes(id))
  if (failed.length > 0) throw new Error(`Could not archive ${failed.join(', ')}.`)
}

// `real` drives the signed-in local CLIs, so only the opt-in `real-sessions` project sets it.
export const test = packagedTest.extend<SessionFixtures, SessionBackendOptions>({
  sessionBackend: ['mock', { option: true, scope: 'worker' }],
  projectSelected: [true, { option: true }],
  slowReply: [false, { option: true }],
  adversarialSeed: [undefined, { option: true }],
  sessionSyncFixture: [undefined, { option: true }],
  // Built per test, because a backend remembers the folders of the one root it started on.
  backend: async ({ sessionBackend }, use) => {
    await use(BACKENDS[sessionBackend]())
  },
  sessionFixture: async ({ root, applicationUnderTest, projectSelected }, use) => {
    const fixture = await prepare(root, applicationUnderTest, { projectSelected })
    readFixtureSessionsFrom(fixture.userData)
    try {
      await use(fixture)
    } finally {
      readFixtureSessionsFrom(null)
    }
  },
  session: async (
    {
      root,
      sessionFixture,
      projectSelected,
      backend,
      slowReply,
      adversarialSeed,
      sessionSyncFixture,
      performanceProfile,
    },
    use,
    testInfo,
  ) => {
    let traced: BrowserContext | undefined
    const session = await createPackagedSessionHarness({
      root,
      fixture: sessionFixture,
      backend,
      launch: { slowReply, adversarialSeed, sessionSyncFixture },
      launched: async (application, page) => {
        traced = await startRecording(performanceProfile, application, async () => page)
      },
      closing: async () => {
        await performanceProfile?.stop()
      },
      videoDir: process.env.ARGO_E2E_VIDEO === '1' ? testInfo.outputPath('video') : undefined,
    })
    try {
      const page = await session.launch()
      if (packagedRun && !(await session.isPackaged()))
        throw new Error('The case did not drive the packaged app.')
      if (projectSelected && sessionSyncFixture === undefined) await archiveFixtures(page)
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
