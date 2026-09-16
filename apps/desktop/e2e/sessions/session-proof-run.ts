// The Session flow's describe: one harness on the backend the project chose, shared by every case in a file.
import { test as base, expect } from '@playwright/test'
import type { Page } from 'playwright-core'
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { describePackagedProof } from '../packaged-proof'
import { feedStateSnapshot } from './feed-selectors'
import { selectProofProject } from './fixtures/feed.fixture'
import { createPackagedSessionHarness } from './packaged-session-harness'
import { createRealSessionCliBackend } from './real-cli/real-session-cli-backend'
import type { SessionBackendOptions } from './session-backend-option'
import type { SessionCliBackend, SessionFixture } from './session-cli-backend'

const BACKENDS = {
  mock: createMockSessionCliBackend,
  real: createRealSessionCliBackend,
} satisfies Record<SessionBackendOptions['sessionBackend'], () => SessionCliBackend>

// `real` drives the signed-in local CLIs, so only the opt-in `real-sessions` project sets it.
export const test = base.extend<object, SessionBackendOptions & { backend: SessionCliBackend }>({
  sessionBackend: ['mock', { option: true, scope: 'worker' }],
  backend: [
    async ({ sessionBackend }, use) => use(BACKENDS[sessionBackend]()),
    { scope: 'worker' },
  ],
})

type Harness = Awaited<ReturnType<typeof createPackagedSessionHarness>>

export type SessionProofRun = {
  readonly root: string
  readonly fixture: SessionFixture
  readonly backend: SessionCliBackend
  launch: Harness['launch']
  restart: Harness['restart']
  isPackaged: Harness['isPackaged']
  // Names the page a failure's feed-state snapshot reads.
  hold: (page: Page) => Page
}

// The page the cases drive, replaced whenever a case restarts the app.
export type PageBox = { get: () => Page; set: (page: Page) => Page }

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

// The first case of a journeys file: every journey starts a Session, which needs a selected Project (#2204).
export function defineLaunchWithProject(run: SessionProofRun, box: PageBox) {
  test('launch', async () => {
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await run.launch())
    expect(await run.isPackaged()).toBe(true)
  })
}

// Members read `harness` when a case runs, because `body` registers cases before `setup` assigns it.
export function describeSessionProof(name: string, body: (run: SessionProofRun) => void) {
  describePackagedProof(test, name, (proof) => {
    let harness: Harness
    let backend: SessionCliBackend
    let page: Page | undefined

    test.beforeAll(async ({ backend: chosen }) => {
      backend = chosen
      harness = await createPackagedSessionHarness(proof.root, backend, proof.trace)
    })
    proof.teardown(async () => {
      await harness?.close()
    })
    proof.onFailure(async (testInfo) => {
      const snapshot = await feedStateSnapshot(page).catch((error: unknown) => ({
        snapshotFailed: String(error),
      }))
      await testInfo.attach('feed-state', {
        body: JSON.stringify(snapshot),
        contentType: 'application/json',
      })
      await testInfo.attach('renderer-console', {
        body: harness.recentConsole().join('\n'),
        contentType: 'text/plain',
      })
    })

    body({
      get root() {
        return proof.root
      },
      get fixture() {
        return harness.fixture
      },
      get backend() {
        return backend
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
