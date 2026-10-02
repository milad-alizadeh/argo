// Reading and operating the packaged Tickets screen by role and name, as a person would find it.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { ElectronApplication, Locator, Page } from 'playwright-core'
import type { MockUser } from '../../mocks/providers/github/mock-github'
import { ADA } from '../../mocks/providers/linear/mock-linear-cast'
import { openRoute } from '../packaged-window'
import { openedURLs, type TicketFixture } from './fixtures/tickets.fixture'

export type Run = { application: ElectronApplication; page: Page; fixture: TicketFixture }

export const press = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true }).click()

// The click opens the trigger; its option then takes Enter rather than a click.
export async function choose(
  page: Page,
  trigger: Locator,
  choice: { role: 'option' | 'menuitemradio'; name: string },
) {
  await trigger.click()
  await page.getByRole(choice.role, { name: choice.name, exact: true }).press('Enter')
}

export const connectForm = (page: Page) =>
  page.getByRole('form', { name: 'Connect a Ticket source' })

export const chooseAccount = (page: Page, name: string) =>
  choose(page, connectForm(page).getByRole('combobox', { name: 'Account' }), {
    role: 'option',
    name,
  })

export const accountsDialog = (page: Page) => page.getByRole('dialog', { name: 'Accounts' })

export const openAccounts = (page: Page) =>
  page.getByRole('button', { name: 'Accounts', exact: true }).click()

// The dialog fades out, and a click meant for the room behind it lands on the fading dialog.
export async function closeAccounts(page: Page) {
  await press(accountsDialog(page), 'Close')
  await accountsDialog(page).waitFor({ state: 'hidden' })
}

// The Detail's title line, which links the Ticket out to its provider.
export const detailTitle = (detail: Locator, title: string) =>
  detail.getByRole('heading', { level: 2 }).filter({ hasText: title })

export const accountRow = (page: Page, login: string, provider = 'GitHub') =>
  accountsDialog(page).getByRole('listitem', { name: `${provider} Account ${login}` })

export const backlog = (page: Page) => page.getByRole('region', { name: 'Backlog' })

// The toast region: where a refusal is told, apart from the alert that repeats it for a screen reader.
export const notification = (page: Page) => page.getByRole('region', { name: 'Notifications' })

export const room = (run: Run) => run.page.getByRole('main', { name: 'Tickets' })

export async function openRoom(page: Page, room: 'tickets' | 'atlas', projectId = 'project-1') {
  await openRoute(page, `#/projects/${projectId}/${room}`)
  if (room !== 'tickets') return
  await page
    .getByRole('main', { name: 'Tickets' })
    .waitFor()
    .catch(async (error: unknown) => {
      // Names the screen that drew instead, since a CI failure keeps no picture of it.
      const drawn = await page.evaluate(() => ({
        hash: window.location.hash,
        headings: [...document.querySelectorAll('h1, h2, [role="main"]')].map(
          (element) => element.getAttribute('aria-label') ?? element.textContent?.slice(0, 80),
        ),
      }))
      throw new Error(`The Tickets room never drew: ${JSON.stringify(drawn)}`, { cause: error })
    })
}

// The keys of the backlog's rows in order: `#607` on GitHub, `ENG-1` on Linear.
export async function backlogKeys(page: Page, key = /^#\d+/): Promise<string[]> {
  await backlog(page).waitFor()
  return backlog(page)
    .getByRole('button', { name: key })
    .evaluateAll(
      (rows, source) => rows.map((row) => row.textContent?.match(new RegExp(source))?.[0] ?? ''),
      key.source,
    )
}

// One device-flow sign-in through the dialog, from the control that starts it to the line that
// says who is now connected. GitHub holds the code until the opened page releases it.
export async function signIn(run: Run, user: MockUser, start: { scope: Locator; name: string }) {
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

// One consent through the dialog. The browser stub loads Linear's page, which answers for Ada and
// redirects to the app's loopback, so no code is shown and none is typed.
export async function signInToLinear(run: Run, start: { scope: Locator; name: string }) {
  run.fixture.linear.signIn(ADA)
  const before = (await openedURLs(run.application)).length
  await press(start.scope, start.name)
  const status = accountsDialog(run.page)
    .getByRole('status')
    .filter({ hasText: `${ADA.name}.` })
  await status.waitFor()
  const opened = (await openedURLs(run.application)).slice(before)
  assert.equal(opened.length, 1)
  assert.ok(opened[0]?.startsWith(`${run.fixture.linear.origin}/oauth/authorize?`))
  return status.textContent()
}

export const storeText = (fixture: TicketFixture, name: string) =>
  readFile(path.join(fixture.userData, 'portable-v1', name), 'utf8').catch(() => '')

// Everything the renderer can ask about Accounts, through the same tRPC channel the screen uses.
export const accountListing = (page: Page) =>
  page.evaluate(() =>
    window.argo.trpc({ id: 0, path: 'accountList', type: 'query', input: undefined }),
  )

// The main process owns the window, so only it can show or hide it; main sees a real show and hide.
export const showWindow = (application: ElectronApplication, shown: boolean) =>
  application.evaluate(({ BrowserWindow }, show) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!show) return window?.hide()
    // Transparent and click-through, so a run never covers the desktop of the person at the machine.
    window?.setOpacity(0)
    window?.setIgnoreMouseEvents(true)
    window?.showInactive()
  }, shown)

// One committed Ticket by native ID: its Argo ID, closure and the time its deletion was confirmed.
export function committedTicket(
  run: Run,
  { provider, scope }: { provider: string; scope: string },
  nativeId: string,
) {
  const database = new DatabaseSync(path.join(run.fixture.userData, 'argo.sqlite'), {
    readOnly: true,
  })
  try {
    const row = database
      .prepare(
        `SELECT ticket.argo_id, ticket_content.state, ticket_content.title, ticket_content.deleted_at
         FROM ticket JOIN ticket_content ON ticket_content.ticket_id = ticket.argo_id
         WHERE ticket.provider = ? AND ticket.scope = ? AND ticket.native_id = ?`,
      )
      .get(provider, scope, nativeId)
    return row === undefined
      ? undefined
      : {
          argoId: String(row.argo_id),
          state: String(row.state),
          title: String(row.title),
          deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
        }
  } finally {
    database.close()
  }
}

// The Argo ID of each Ticket the main process committed for one provider scope, by native ID.
export function committedTicketIds(
  run: Run,
  { provider, scope }: { provider: string; scope: string },
): Record<string, string> {
  const database = new DatabaseSync(path.join(run.fixture.userData, 'argo.sqlite'), {
    readOnly: true,
  })
  try {
    const rows = database
      .prepare(
        `SELECT ticket.native_id, ticket.argo_id FROM ticket
         JOIN ticket_content ON ticket_content.ticket_id = ticket.argo_id
         WHERE ticket.provider = ? AND ticket.scope = ?`,
      )
      .all(provider, scope)
    return Object.fromEntries(rows.map((row) => [String(row.native_id), String(row.argo_id)]))
  } finally {
    database.close()
  }
}
