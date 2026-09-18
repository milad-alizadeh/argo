// The packaged app, its own application data, a mock GitHub and a mock Linear, for the Ticket proof.
// The providers are the one thing mocked; the cockpit, its stores and safeStorage all run for real.
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { type ElectronApplication, _electron as electron } from 'playwright-core'
import type { MockGitHub } from '../../../mocks/providers/github/mock-github'
import { startMockGitHubLoopback } from '../../../mocks/providers/github/mock-github-loopback'
import type { MockLinear } from '../../../mocks/providers/linear/mock-linear'
import { HIDDEN, TEAM } from '../../../mocks/providers/linear/mock-linear-cast'
import { startMockLinearLoopback } from '../../../mocks/providers/linear/mock-linear-loopback'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mjs'
import { sharedDatabasePath } from '../../../src/core/storage/shared-database'
import { PROJECT_PROOF_STORE_ENV } from '../../../src/domains/projects/main/proof-protocol'
import { createProjectStore } from '../../../src/domains/projects/main/sqlite-store'
import {
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../../../src/domains/sessions/main/proof-protocol'
import {
  GITHUB_PROOF_ORIGIN_ENV,
  LINEAR_PROOF_ORIGIN_ENV,
} from '../../../src/providers/proof-protocol'
import { appExecutable } from '../../packaged-app'
import { repository } from '../../projects/fixtures/project.fixture'

export const OCTOCAT = { id: 583231, login: 'octocat' }
export const HUBOT = { id: 2, login: 'hubot' }
// Short enough that every read renews the grant first, so a relaunch proves the refresh.
export const LINEAR_TOKEN_LIFETIME = 60

export type TicketFixture = {
  application: string
  userData: string
  // An empty folder, so the Sessions room reads no transcript of the person running the proof.
  noSessions: string
  github: MockGitHub
  linear: MockLinear
}

function serveRepositories(github: MockGitHub) {
  github.addRepository({
    fullName: 'octocat/hello-world',
    visibleTo: [OCTOCAT.id, HUBOT.id],
    issues: [
      { number: 609, title: 'Prototype the Tickets room' },
      {
        number: 607,
        title: 'Wayfinder: the Tickets room, end to end',
        body: 'The backlog in the deck and the Ticket beside it.',
        labels: [{ name: 'wayfinder', color: '5319e7' }],
        type: 'PRD',
        children: [609, 388],
        blockedBy: [609],
      },
      { number: 388, title: 'Ticket read path', state: 'closed' },
      { number: 273, title: 'The Next-up planner' },
      { number: 700, title: 'A pull request is not a Ticket', pullRequest: true },
    ],
  })
  github.addRepository({ fullName: 'octocat/secret', visibleTo: [], issues: [] })
}

function serveTeams(linear: MockLinear) {
  linear.addTeam(TEAM)
  linear.addTeam(HIDDEN)
  linear.tokenLifetime(LINEAR_TOKEN_LIFETIME)
}

export async function prepare(root: string, application: string): Promise<TicketFixture> {
  const userData = path.join(root, 'userData')
  const projectPath = await repository(path.join(root, 'argo'))
  const noSessions = path.join(root, 'no-sessions')
  await mkdir(userData, { recursive: true })
  await mkdir(noSessions, { recursive: true })
  const projects = createProjectStore(new DatabaseSync(sharedDatabasePath(userData)))
  projects.replace({
    projects: [
      { id: 'project-1', path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
    selectedId: 'project-1',
  })
  projects.close()
  const github = await startMockGitHubLoopback()
  serveRepositories(github)
  const linear = await startMockLinearLoopback()
  serveTeams(linear)
  return { application, userData, noSessions, github, linear }
}

// The mock keychain keeps safeStorage off the login keychain, whose prompt no proof can answer.
export async function launch(fixture: TicketFixture): Promise<ElectronApplication> {
  const application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    args: ['--use-mock-keychain'],
    env: {
      ...process.env,
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [GITHUB_PROOF_ORIGIN_ENV]: fixture.github.origin,
      [LINEAR_PROOF_ORIGIN_ENV]: fixture.linear.origin,
      [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.noSessions,
      [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.noSessions,
      [ACCEPTANCE_ENV]: '0',
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
