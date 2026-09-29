// The Ticket proof's automatic refresh (#2870): main polls the Project on screen only while its
// window can be seen, scans again when the window returns, and a failed scan keeps the saved rows
// on screen and retries until GitHub answers. The proof's window starts hidden.
import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright-core'
import { helloWorld } from '../fixtures/tickets.fixture'
import { backlog, type Run } from '../screen'

// The main process owns the window, so only it can show or hide it as a person would.
const showWindow = (application: ElectronApplication, shown: boolean) =>
  application.evaluate(({ BrowserWindow }, show) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (show) window?.showInactive()
    else window?.hide()
  }, shown)

// The repository as GitHub serves it after Tickets are created outside Argo.
function createOnGitHub(run: Run, numbers: readonly number[]) {
  const repository = helloWorld()
  for (const number of numbers) repository.issues.push({ number, title: `Created as #${number}` })
  run.fixture.github.addRepository(repository)
}

const row = (run: Run, number: number) =>
  backlog(run.page).getByRole('button', { name: new RegExp(`^#${number}`) })

// Several polls pass while each assertion waits, so a missing row proves nothing polled.
export async function proveAutomaticRefresh(run: Run, pollMs: number) {
  const idle = pollMs * 4
  await backlog(run.page).waitFor()
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
  await test.step('hidden-again', async () => {
    await showWindow(run.application, false)
    // A poll already under way when the window hid may still land.
    await run.page.waitForTimeout(pollMs * 2)
    createOnGitHub(run, [710, 711, 712, 713])
    await run.page.waitForTimeout(idle)
    await expect(row(run, 713)).toHaveCount(0)
  })
}
