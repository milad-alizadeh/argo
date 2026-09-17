// Each Ticket case declares its starting Accounts and source, reached by a person's gestures (#2326).
import type { BrowserContext, ElectronApplication } from 'playwright-core'
import { ADA } from '../../mocks/providers/linear/mock-linear-cast'
import { finishRecording, test as packagedTest, startRecording } from '../packaged-proof'
import { HUBOT, launch, OCTOCAT, prepare, type TicketFixture } from './fixtures/tickets.fixture'
import {
  accountsDialog,
  backlog,
  chooseAccount,
  connectForm,
  openRoom,
  press,
  type Run,
  room,
  signIn,
  signInToLinear,
} from './screen'

export type TicketState =
  // No Account and no source.
  | 'none'
  // GitHub Accounts for octocat and hubot, and no source.
  | 'github-accounts'
  // Those Accounts, with octocat's `octocat/hello-world` connected.
  | 'github-repository'
  // Those GitHub Accounts, with Ada's Linear Account and its Engine team connected.
  | 'linear-team'

async function start(fixture: TicketFixture): Promise<Run> {
  const application = await launch(fixture)
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.listTickets === 'function')
  return { application, page, fixture }
}

async function connectGitHubAccounts(run: Run) {
  await openRoom(run.page, 'tickets')
  const notice = run.page.getByRole('region', { name: 'Sign-in notice' })
  await press(notice, 'Dismiss')
  await press(room(run), 'Connect an Account')
  const connect = { scope: accountsDialog(run.page), name: 'Connect a GitHub Account' }
  await signIn(run, OCTOCAT, connect)
  await signIn(run, HUBOT, connect)
  await press(accountsDialog(run.page), 'Close')
}

async function connectRepository(run: Run) {
  await chooseAccount(run.page, 'GitHub · octocat')
  await connectForm(run.page).getByRole('combobox', { name: 'Repository' }).fill('hello')
  await run.page.getByRole('option', { name: 'octocat/hello-world' }).click()
  await press(connectForm(run.page), 'Connect repository')
  await backlog(run.page).waitFor()
}

async function connectLinearTeam(run: Run) {
  await run.page.getByRole('button', { name: 'Accounts', exact: true }).click()
  await signInToLinear(run, { scope: accountsDialog(run.page), name: 'Connect a Linear Account' })
  await press(accountsDialog(run.page), 'Close')
  await chooseAccount(run.page, `Linear · ${ADA.name}`)
  await connectForm(run.page).getByRole('combobox', { name: 'Team' }).fill('Eng')
  await run.page.getByRole('option', { name: 'Engine' }).click()
  await press(connectForm(run.page), 'Connect team')
  await backlog(run.page).waitFor()
}

const SETUP: Record<TicketState, (run: Run) => Promise<void>> = {
  none: async () => {},
  'github-accounts': connectGitHubAccounts,
  'github-repository': async (run) => {
    await connectGitHubAccounts(run)
    await connectRepository(run)
  },
  'linear-team': async (run) => {
    await connectGitHubAccounts(run)
    await connectLinearTeam(run)
  },
}

export type Tickets = {
  // The launch the case is driving now, which a restart replaces.
  run: () => Run
  restart: () => Promise<Run>
}

export const test = packagedTest.extend<{ ticketState: TicketState; tickets: Tickets }>({
  ticketState: ['none', { option: true }],
  tickets: async (
    { root, packagedApplication, ticketState, performanceProfile },
    use,
    testInfo,
  ) => {
    const fixture = await prepare(root, packagedApplication)
    let application: ElectronApplication | undefined
    let traced: BrowserContext | undefined
    const open = async () => {
      const run = await start(fixture)
      application = run.application
      traced = await startRecording(performanceProfile, run.application, async () => run.page)
      return run
    }
    try {
      let run = await open()
      await SETUP[ticketState](run)
      await use({
        run: () => run,
        restart: async () => {
          // The samples belong to the window that produced them, so the recording ends with it.
          await performanceProfile?.stop()
          await run.application.close()
          run = await open()
          return run
        },
      })
      await finishRecording(performanceProfile, traced, testInfo)
    } finally {
      await performanceProfile?.stop()
      await application?.close()
      await fixture.github.close()
      await fixture.linear.close()
    }
  },
})
