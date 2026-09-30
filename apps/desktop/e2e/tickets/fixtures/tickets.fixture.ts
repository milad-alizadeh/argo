// The packaged app, its own application data, a mock GitHub and a mock Linear, for the Ticket proof.
// The providers are the one thing mocked; the cockpit, its stores and safeStorage all run for real.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { type ElectronApplication, _electron as electron } from 'playwright-core'
import { TICKET_POLL_PROOF_ENV } from '@/domains/tickets/main/sync/proof-protocol'
import type { MockGitHub } from '@/mocks/providers/github/mock-github'
import {
  engineRepository,
  helloWorldRepository,
  secretRepository,
} from '@/mocks/tickets/provider-inputs'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { GITHUB_PROOF_ORIGIN_ENV, LINEAR_PROOF_ORIGIN_ENV } from '@/providers/proof-protocol'
import { startMockGitHubLoopback } from '../../../mocks/providers/github/mock-github-loopback'
import type { MockLinear } from '../../../mocks/providers/linear/mock-linear'
import { HIDDEN, TEAM } from '../../../mocks/providers/linear/mock-linear-cast'
import { startMockLinearLoopback } from '../../../mocks/providers/linear/mock-linear-loopback'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mts'
import { launchCommand } from '../../application-under-test'
import { makeProjectLocallyReady } from '../../projects/fixtures/locally-ready-project'
import { repository, seedSingleProject } from '../../projects/fixtures/project.fixture'
import { signedInHarnessEnvironment } from '../../signed-in-harness'

// Short enough that every read renews the grant first, so a relaunch proves the refresh.
export const LINEAR_TOKEN_LIFETIME = 60

export type TicketFixture = {
  application: string
  userData: string
  // An empty folder, so the Sessions room reads no transcript of the person running the proof.
  noSessions: string
  github: MockGitHub
  linear: MockLinear
  // The active poll in milliseconds, or null for the minute a person waits.
  pollMs: number | null
}

// A fresh copy each time, since the mock closes an issue in place.
export const helloWorld = helloWorldRepository

function serveRepositories(github: MockGitHub) {
  github.addRepository(helloWorld())
  github.addRepository(secretRepository())
  github.addRepository(engineRepository())
}

function serveTeams(linear: MockLinear) {
  linear.addTeam(TEAM)
  linear.addTeam(HIDDEN)
  linear.tokenLifetime(LINEAR_TOKEN_LIFETIME)
}

export async function prepare(
  root: string,
  application: string,
  pollMs: number | null,
): Promise<TicketFixture> {
  const userData = path.join(root, 'userData')
  const projectPath = await repository(path.join(root, 'argo'))
  await makeProjectLocallyReady(projectPath)
  const noSessions = path.join(root, 'no-sessions')
  await mkdir(userData, { recursive: true })
  await mkdir(noSessions, { recursive: true })
  seedSingleProject(userData, { id: 'project-1', path: projectPath })
  // A second Project, so a case can switch the Project on screen.
  const secondPath = await repository(path.join(root, 'engine'))
  await makeProjectLocallyReady(secondPath)
  seedSingleProject(userData, { id: 'project-2', path: secondPath })
  const github = await startMockGitHubLoopback()
  serveRepositories(github)
  const linear = await startMockLinearLoopback()
  serveTeams(linear)
  return { application, userData, noSessions, github, linear, pollMs }
}

// The mock keychain keeps safeStorage off the login keychain, whose prompt no proof can answer.
export async function launch(fixture: TicketFixture): Promise<ElectronApplication> {
  const application = await electron.launch({
    ...launchCommand(fixture.application, ['--use-mock-keychain']),
    env: {
      ...process.env,
      ...(await signedInHarnessEnvironment(path.dirname(fixture.userData))),
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [GITHUB_PROOF_ORIGIN_ENV]: fixture.github.origin,
      [LINEAR_PROOF_ORIGIN_ENV]: fixture.linear.origin,
      // Claude lists its Sessions from an empty home, never the machine's own.
      CLAUDE_CONFIG_DIR: fixture.noSessions,
      [ACCEPTANCE_ENV]: '0',
      ...(fixture.pollMs === null ? {} : { [TICKET_POLL_PROOF_ENV]: String(fixture.pollMs) }),
    },
    timeout: 30_000,
  })
  // The browser is the main process's to open, so the stub replaces it there. It records the URL
  // and loads it: the person entering GitHub's code, or allowing Argo on Linear's consent page.
  await application.evaluate(({ shell }) => {
    const opened: string[] = []
    Object.assign(globalThis, { openedURLs: opened })
    shell.openExternal = async (url) => {
      opened.push(url)
      await fetch(url)
    }
  })
  return application
}

export const openedURLs = (application: ElectronApplication) =>
  application.evaluate(() => (globalThis as unknown as { openedURLs: string[] }).openedURLs)
