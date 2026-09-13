// The Ticket proof's cases, each read off the screen of the packaged cockpit and then off the files
// its main process wrote. GitHub is the fake; everything else is the shipped app.
import assert from 'node:assert/strict'
import { HUBOT, OCTOCAT } from './ticket-proof-fixture'
import {
  accountRow,
  accountsDialog,
  backlog,
  backlogNumbers,
  openRoom,
  press,
  type Run,
  signIn,
  storeText,
} from './ticket-proof-screen'

const room = (run: Run) => run.page.getByRole('main', { name: 'Tickets' })

export async function proveConnect(run: Run) {
  await openRoom(run.page, 'tickets')
  const notice = run.page.getByRole('region', { name: 'GitHub sign-in notice' })
  await press(notice, 'Dismiss')
  await notice.waitFor({ state: 'detached' })
  await run.page.getByText('Connect GitHub to read Tickets').waitFor()
  const start = { scope: accountsDialog(run.page), name: 'Connect a GitHub Account' }
  await press(room(run), 'Connect GitHub')
  assert.equal(await signIn(run, OCTOCAT, start), 'Connected octocat.')
  // The same GitHub identity signs in again as the one Account; another identity is another.
  assert.equal(await signIn(run, OCTOCAT, start), 'Signed in again as octocat.')
  assert.equal(await signIn(run, HUBOT, start), 'Connected hubot.')
  await accountRow(run.page, 'hubot').waitFor()
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
  await press(accountsDialog(run.page), 'Close')
}

export async function proveBind(run: Run) {
  const form = run.page.getByRole('form', { name: 'Bind a repository' })
  await form.getByRole('combobox', { name: 'GitHub Account' }).selectOption({ label: 'octocat' })
  const scope = form.getByRole('textbox', { name: 'Repository' })
  // GitHub, not the form, decides what the Account can read, and a refusal binds nothing.
  await scope.fill('octocat/secret')
  await press(form, 'Bind repository')
  await form.getByText('This GitHub Account cannot see that repository.').waitFor()
  assert.equal(await storeText(run.fixture, 'bindings.json'), '')
  await scope.fill('octocat/hello-world')
  await press(form, 'Bind repository')
  await backlog(run.page).waitFor()
  assert.equal(
    (await storeText(run.fixture, 'bindings.json')).includes('octocat/hello-world'),
    true,
  )
}

export async function proveBacklog(run: Run) {
  // #609 sits under its parent; the closed #388 and the pull request #700 are not Tickets here.
  assert.deepEqual(await backlogNumbers(run.page), ['#607', '#609', '#273'])
  await backlog(run.page).getByText('All open · 3 Tickets').waitFor()
  await backlog(run.page).getByRole('button', { name: /^#607/ }).dispatchEvent('click')
  const detail = run.page.getByRole('article', { name: 'Ticket #607' })
  await detail.getByRole('heading', { name: 'Wayfinder: the Tickets room, end to end' }).waitFor()
  await detail.getByText('The backlog in the deck and the Ticket beside it.').waitFor()
  await detail.getByText('wayfinder', { exact: true }).waitFor()
  await detail.getByRole('region', { name: 'Children · 1 of 2 closed' }).waitFor()
  await detail.getByRole('region', { name: 'Blocked by · 1' }).waitFor()
  await run.page.getByRole('button', { name: 'GitHub · octocat Connected' }).waitFor()
}

// A fresh launch reads the sealed grant back. GitHub is down for it, so the failure is on screen,
// and reading again once GitHub answers draws the same backlog.
export async function proveRestartAndFailure(run: Run) {
  await openRoom(run.page, 'tickets')
  const failure = room(run).getByRole('alert').filter({ hasText: 'Unable to read Tickets' })
  await failure.getByText('Argo cannot reach GitHub.').waitFor()
  assert.equal(await run.page.getByRole('region', { name: 'GitHub sign-in notice' }).count(), 0)
  run.fixture.github.outage('none')
  await press(failure, 'Try again')
  assert.deepEqual(await backlogNumbers(run.page), ['#607', '#609', '#273'])
}

export async function proveRevoked(run: Run) {
  run.fixture.github.revoke('octocat')
  await openRoom(run.page, 'atlas')
  await openRoom(run.page, 'tickets')
  await room(run).getByText('GitHub no longer accepts octocat').waitFor()
  const foot = run.page.getByRole('button', { name: 'GitHub · octocat Access revoked' })
  await foot.dispatchEvent('click')
  const octocat = accountRow(run.page, 'octocat')
  await octocat.getByText('Access revoked').waitFor()
  await octocat
    .getByRole('list', { name: 'Bindings for octocat' })
    .getByText(/hello-world/)
    .waitFor()
  // Revocation is the Account's own: the other identity stays connected.
  await accountRow(run.page, 'hubot').getByText('Connected', { exact: true }).waitFor()
  const start = { scope: octocat, name: 'Reconnect' }
  assert.equal(await signIn(run, OCTOCAT, start), 'Signed in again as octocat.')
  await press(accountsDialog(run.page), 'Close')
  assert.deepEqual(await backlogNumbers(run.page), ['#607', '#609', '#273'])
}

export async function proveDisconnect(run: Run) {
  await run.page.getByRole('button', { name: 'GitHub · octocat Connected' }).dispatchEvent('click')
  const octocat = accountRow(run.page, 'octocat')
  await press(octocat, 'Disconnect…')
  await press(octocat, 'Disconnect')
  await octocat.waitFor({ state: 'detached' })
  assert.equal((await storeText(run.fixture, 'grants.json')).includes('github:583231'), false)
  await press(accountsDialog(run.page), 'Close')
  await room(run).getByText('The GitHub Account for this Binding is disconnected').waitFor()
  await press(room(run), 'Unbind')
  await room(run).getByRole('heading', { name: 'Bind argo to a repository' }).waitFor()
}
