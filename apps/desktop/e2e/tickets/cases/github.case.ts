// The Ticket proof's connection and backlog cases, read off the screen of the packaged cockpit and
// then off the files its main process wrote. GitHub is the mock; everything else is the shipped
// app. Its account lifecycle cases are `lifecycle.case.ts`, and Linear's are
// `linear.case.ts`.
import assert from 'node:assert/strict'
import { test } from '@playwright/test'
import { HUBOT, OCTOCAT } from '../fixtures/tickets.fixture'
import {
  accountRow,
  accountsDialog,
  backlog,
  backlogKeys,
  chooseAccount,
  connectForm,
  openRoom,
  press,
  type Run,
  room,
  signIn,
  storeText,
} from '../screen'

export async function proveConnect(run: Run) {
  await openRoom(run.page, 'tickets')
  const notice = run.page.getByRole('region', { name: 'Sign-in notice' })
  await press(notice, 'Dismiss')
  await notice.waitFor({ state: 'detached' })
  await run.page.getByText('Connect an Account to read Tickets').waitFor()
  const start = { scope: accountsDialog(run.page), name: 'Connect a GitHub Account' }
  await press(room(run), 'Connect an Account')
  await test.step('connect', async () => {
    assert.equal(await signIn(run, OCTOCAT, start), 'Connected octocat.')
  })
  // The same GitHub identity signs in again as the one Account; another identity is another.
  await test.step('same-identity', async () => {
    assert.equal(await signIn(run, OCTOCAT, start), 'Signed in again as octocat.')
  })
  await test.step('second-identity', async () => {
    assert.equal(await signIn(run, HUBOT, start), 'Connected hubot.')
    await accountRow(run.page, 'hubot').waitFor()
  })
  await test.step('sealed-grant', async () => {
    const rows = accountsDialog(run.page).getByRole('listitem', { name: /^GitHub Account / })
    assert.equal(await rows.count(), 2)
    // The grant is sealed on disk, and nothing the renderer can ask for carries it.
    const listing = await run.page.evaluate(() =>
      window.argo.listAccounts({ version: 1, type: 'account.list', requestId: 'proof' }),
    )
    for (const text of [JSON.stringify(listing), await storeText(run.fixture, 'grants.json')]) {
      assert.equal(text.includes('token-'), false)
    }
    assert.equal((await storeText(run.fixture, 'accounts.json')).includes('token-'), false)
  })
  await test.step('repository-form-inline', async () => {
    // The repository-connect form draws inside the Accounts dialog once an Account connects, so
    // it never needs a second, stacked dialog (#2411).
    await connectForm(run.page)
      .getByRole('combobox', { name: 'Account' })
      .getByText('GitHub · octocat')
      .waitFor()
    await accountsDialog(run.page).waitFor({ state: 'attached' })
  })
}

export async function proveConnectRepository(run: Run) {
  const form = connectForm(run.page)
  await chooseAccount(run.page, 'GitHub · octocat')
  await form.getByRole('combobox', { name: 'Account' }).getByText('GitHub · octocat').waitFor()
  const scope = form.getByRole('combobox', { name: 'Repository' })
  await test.step('unlisted-repository', async () => {
    // GitHub, not the form, decides what the Account can read, so a hidden repository is never offered.
    await scope.fill('octocat/secret')
    await run.page.getByText('No repository matches.').waitFor()
  })
  await test.step('discoverSources', async () => {
    await scope.fill('hello')
    await run.page.getByRole('option', { name: 'octocat/hello-world' }).click()
    assert.equal(await scope.inputValue(), 'octocat/hello-world')
    assert.equal(await storeText(run.fixture, 'connections.json'), '')
  })
  await test.step('connectSource', async () => {
    await press(form, 'Connect repository')
    await backlog(run.page).waitFor()
    // The Ticket connects and the dialog it was drawn in closes, so nothing is left over it.
    await accountsDialog(run.page).waitFor({ state: 'detached' })
    assert.equal(
      (await storeText(run.fixture, 'connections.json')).includes('octocat/hello-world'),
      true,
    )
  })
}

export async function proveBacklog(run: Run) {
  await test.step('list', async () => {
    // #609 sits under its parent; the closed #388 and the pull request #700 are not Tickets here.
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    await backlog(run.page).getByText('All open · 3 Tickets').waitFor()
  })
  await test.step('detail', async () => {
    await backlog(run.page).getByRole('button', { name: /^#607/ }).click()
    const detail = run.page.getByRole('article', { name: 'Ticket #607' })
    await detail.getByRole('heading', { name: 'Wayfinder: the Tickets room, end to end' }).waitFor()
    await detail.getByText('The backlog in the deck and the Ticket beside it.').waitFor()
    await detail.getByText('wayfinder', { exact: true }).waitFor()
    await detail.getByRole('region', { name: 'Children · 1 of 2 closed' }).waitFor()
    await detail.getByRole('region', { name: 'Blocked by · 1' }).waitFor()
    await run.page.getByRole('button', { name: 'GitHub · octocat Connected' }).waitFor()
  })
}
