// The packaged app, its own application data and a fake GitHub, for the Ticket proof. GitHub is
// the one thing faked; the cockpit, its stores and Electron's safeStorage all run for real.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type ElectronApplication, _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import { type FakeGitHub, startFakeGitHub } from '../../../providers/github/fake-driver/fake-github'
import { appExecutable, packagedTestCopy } from '../../desktop-proof/packaged-test-copy'
import { repository } from '../../projects/fake-driver/project-proof-fixture'
import { PROJECT_PROOF_STORE_ENV } from '../../projects/fake-driver/project-proof-protocol'
import {
  SESSION_CLAUDE_ARCHIVE_ENV,
  SESSION_CLAUDE_TRANSCRIPTS_ENV,
  SESSION_CODEX_TRANSCRIPTS_ENV,
} from '../../sessions/proof-protocol'
import { GITHUB_PROOF_ORIGIN_ENV } from './ticket-proof-protocol'

export const OCTOCAT = { id: 583231, login: 'octocat' }
export const HUBOT = { id: 2, login: 'hubot' }

export type TicketFixture = {
  application: string
  userData: string
  // An empty folder, so the Sessions room reads no transcript of the person running the proof.
  noSessions: string
  github: FakeGitHub
}

function serveRepositories(github: FakeGitHub) {
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

export async function prepare(root: string): Promise<TicketFixture> {
  const application = await packagedTestCopy(root)
  const userData = path.join(root, 'userData')
  const projectPath = await repository(path.join(root, 'argo'))
  await mkdir(path.join(userData, 'portable-v1'), { recursive: true })
  await writeFile(
    path.join(userData, 'portable-v1', 'projects.json'),
    JSON.stringify({
      version: 1,
      projects: [{ id: 'project-1', path: projectPath }],
      selectedId: 'project-1',
    }),
  )
  const github = await startFakeGitHub()
  serveRepositories(github)
  return { application, userData, noSessions: path.join(root, 'no-sessions'), github }
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
      [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.noSessions,
      [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.noSessions,
      [SESSION_CLAUDE_ARCHIVE_ENV]: fixture.noSessions,
      [ACCEPTANCE_ENV]: '0',
    },
    timeout: 30_000,
  })
  // The browser is the main process's to open, so the stub replaces it there. It records the URL
  // and loads it, which is the person reaching GitHub's device page and entering the code.
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
