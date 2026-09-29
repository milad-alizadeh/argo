// The Ticket proof's automatic refresh (#2870). The proof's window starts hidden.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import { helloWorldRepository as helloWorld } from '@/mocks/tickets/provider-inputs'
import {
  backlog,
  chooseAccount,
  committedTicketIds,
  connectForm,
  openRoom,
  press,
  type Run,
  showWindow,
} from '../screen'

const GITHUB_SCOPE = { provider: 'github', scope: 'octocat/hello-world' }

// The repository as GitHub serves it after Tickets are created outside Argo.
function createOnGitHub(run: Run, numbers: readonly number[]) {
  const repository = helloWorld()
  for (const number of numbers) repository.issues.push({ number, title: `Created as #${number}` })
  run.fixture.github.addRepository(repository)
}

const row = (run: Run, number: number) =>
  backlog(run.page).getByRole('button', { name: new RegExp(`^#${number}`) })

// A Project with no source yet, connected to the second repository from its own Tickets room.
async function connectSecondProject(run: Run) {
  await openRoom(run.page, 'tickets', 'project-2')
  await chooseAccount(run.page, 'GitHub · octocat')
  await connectForm(run.page).getByRole('combobox', { name: 'Repository' }).fill('engine')
  await run.page.getByRole('option', { name: 'octocat/engine' }).click()
  await press(connectForm(run.page), 'Connect repository')
  await row(run, 5).waitFor()
}

// Each wait for nothing to happen spans several polls.
export async function proveAutomaticRefresh(run: Run, pollMs: number) {
  const idle = pollMs * 4
  await backlog(run.page).waitFor()
  // The entry scan ends before GitHub changes, so only a later scan can read the change.
  await expect(backlog(run.page).getByText(/^Refreshing from/)).toHaveCount(0)
  await test.step('hidden-window-is-not-polled', async () => {
    createOnGitHub(run, [710])
    await run.page.waitForTimeout(idle)
    await expect(row(run, 710)).toHaveCount(0)
  })
  await test.step('window-return', async () => {
    await showWindow(run.application, true)
    await row(run, 710).waitFor()
  })
  await test.step('visible-window-polls', async () => {
    createOnGitHub(run, [710, 711])
    await row(run, 711).waitFor()
  })
  await test.step('failure-keeps-rows', async () => {
    run.fixture.github.outage('down')
    const alert = backlog(run.page).getByRole('alert')
    await alert.getByText('Argo cannot reach GitHub.').waitFor()
    await expect(row(run, 710)).toBeVisible()
  })
  await test.step('retry-recovers', async () => {
    createOnGitHub(run, [710, 711, 712])
    run.fixture.github.outage('none')
    await row(run, 712).waitFor()
    await expect(backlog(run.page).getByRole('alert')).toHaveCount(0)
  })
  await test.step('project-switch', async () => {
    await connectSecondProject(run)
    // The Project off screen is not polled, so its change waits for the switch back.
    createOnGitHub(run, [710, 711, 712, 714])
    await run.page.waitForTimeout(idle)
    assert.equal(committedTicketIds(run, GITHUB_SCOPE)['#714'], undefined)
    await openRoom(run.page, 'tickets')
    await row(run, 714).waitFor()
  })
  await test.step('hidden-again', async () => {
    await showWindow(run.application, false)
    // A poll already under way when the window hid may still land.
    await run.page.waitForTimeout(pollMs * 2)
    createOnGitHub(run, [710, 711, 712, 714, 713])
    await run.page.waitForTimeout(idle)
    await expect(row(run, 713)).toHaveCount(0)
  })
}
