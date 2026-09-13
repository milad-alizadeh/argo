// Reading and operating the packaged Tickets room by role and name, as a person would find it.
// Every press is dispatched into the renderer: the proof window is never shown, so nothing is
// there to hit-test, and no real keyboard or mouse is taken.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ElectronApplication, Locator, Page } from 'playwright-core'
import type { FakeUser } from '../../../providers/github/fake-driver/fake-github'
import { openedURLs, type TicketFixture } from './ticket-proof-fixture'

export type Run = { application: ElectronApplication; page: Page; fixture: TicketFixture }

export const press = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true }).dispatchEvent('click')

export const accountsDialog = (page: Page) => page.getByRole('dialog', { name: 'GitHub Accounts' })

export const accountRow = (page: Page, login: string) =>
  accountsDialog(page).getByRole('listitem', { name: `GitHub Account ${login}` })

export const backlog = (page: Page) => page.getByRole('region', { name: 'Backlog' })

export async function openRoom(page: Page, room: 'tickets' | 'atlas') {
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, `#/${room}`)
  if (room === 'tickets') await page.getByRole('main', { name: 'Tickets' }).waitFor()
}

export async function backlogNumbers(page: Page): Promise<string[]> {
  await backlog(page).waitFor()
  return backlog(page)
    .getByRole('button', { name: /^#\d+/ })
    .evaluateAll((rows) => rows.map((row) => row.textContent?.match(/^#\d+/)?.[0] ?? ''))
}

// One device-flow sign-in through the dialog, from the control that starts it to the line that
// says who is now connected. GitHub holds the code until the opened page releases it.
export async function signIn(run: Run, user: FakeUser, start: { scope: Locator; name: string }) {
  run.fixture.github.holdSignIn(user)
  const before = (await openedURLs(run.application)).length
  await press(start.scope, start.name)
  const dialog = accountsDialog(run.page)
  await dialog.getByLabel('GitHub code').waitFor()
  await press(dialog, 'Copy code and open GitHub')
  await dialog
    .getByRole('status')
    .filter({ hasText: `${user.login}.` })
    .waitFor()
  // Only the device page the main process validated was opened, and only once.
  assert.deepEqual((await openedURLs(run.application)).slice(before), [
    `${run.fixture.github.origin}/login/device`,
  ])
  return dialog
    .getByRole('status')
    .filter({ hasText: `${user.login}.` })
    .textContent()
}

export const storeText = (fixture: TicketFixture, name: string) =>
  readFile(path.join(fixture.userData, 'portable-v1', name), 'utf8').catch(() => '')
