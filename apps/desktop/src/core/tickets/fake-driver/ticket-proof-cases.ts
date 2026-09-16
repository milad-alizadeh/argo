// The Ticket proof's cases, each read off the screen of the packaged cockpit and then off the files
// its main process wrote. GitHub is the fake; everything else is the shipped app. Linear's are
// `linear-proof-cases.ts`.
import assert from 'node:assert/strict'
import { HUBOT, OCTOCAT } from './ticket-proof-fixture'
import {
  accountRow,
  accountsDialog,
  backlog,
  backlogKeys,
  choose,
  chooseAccount,
  connectForm,
  openRoom,
  press,
  type Run,
  signIn,
  storeText,
} from './ticket-proof-screen'

const room = (run: Run) => run.page.getByRole('main', { name: 'Tickets' })

export async function proveConnect(run: Run) {
  await openRoom(run.page, 'tickets')
  const notice = run.page.getByRole('region', { name: 'Sign-in notice' })
  await press(notice, 'Dismiss')
  await notice.waitFor({ state: 'detached' })
  await run.page.getByText('Connect an Account to read Tickets').waitFor()
  const start = { scope: accountsDialog(run.page), name: 'Connect a GitHub Account' }
  await press(room(run), 'Connect an Account')
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

export async function proveConnectRepository(run: Run) {
  const form = connectForm(run.page)
  await chooseAccount(run.page, 'GitHub · octocat')
  await form.getByRole('combobox', { name: 'Account' }).getByText('GitHub · octocat').waitFor()
  const scope = form.getByRole('combobox', { name: 'Repository' })
  // GitHub, not the form, decides what the Account can read, so a hidden repository is never offered.
  await scope.fill('octocat/secret')
  await run.page.getByText('No repository matches.').waitFor()
  await scope.fill('hello')
  await run.page.getByRole('option', { name: 'octocat/hello-world' }).click()
  assert.equal(await scope.inputValue(), 'octocat/hello-world')
  assert.equal(await storeText(run.fixture, 'connections.json'), '')
  await press(form, 'Connect repository')
  await backlog(run.page).waitFor()
  assert.equal(
    (await storeText(run.fixture, 'connections.json')).includes('octocat/hello-world'),
    true,
  )
}

export async function proveBacklog(run: Run) {
  // #609 sits under its parent; the closed #388 and the pull request #700 are not Tickets here.
  assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
  await backlog(run.page).getByText('All open · 3 Tickets').waitFor()
  await backlog(run.page).getByRole('button', { name: /^#607/ }).click()
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
  assert.equal(await run.page.getByRole('region', { name: 'Sign-in notice' }).count(), 0)
  run.fixture.github.outage('none')
  await press(failure, 'Try again')
  assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
}

export async function proveRevoked(run: Run) {
  run.fixture.github.revoke('octocat')
  await openRoom(run.page, 'atlas')
  await openRoom(run.page, 'tickets')
  await room(run).getByText('GitHub no longer accepts octocat').waitFor()
  const foot = run.page.getByRole('button', { name: 'GitHub · octocat Access revoked' })
  await foot.click()
  const octocat = accountRow(run.page, 'octocat')
  await octocat.getByText('Access revoked').waitFor()
  await octocat
    .getByRole('list', { name: 'Repositories for octocat' })
    .getByText(/hello-world/)
    .waitFor()
  // Revocation is the Account's own: the other identity stays connected.
  await accountRow(run.page, 'hubot').getByText('Connected', { exact: true }).waitFor()
  const start = { scope: octocat, name: 'Reconnect' }
  assert.equal(await signIn(run, OCTOCAT, start), 'Signed in again as octocat.')
  await press(accountsDialog(run.page), 'Close')
  assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
}

// Closing #273 as not planned from its Detail reaches GitHub: the next read leaves it out.
export async function proveChangeState(run: Run) {
  await backlog(run.page).getByRole('button', { name: /^#273/ }).click()
  const detail = run.page.getByRole('article', { name: 'Ticket #273' })
  await choose(run.page, detail.getByRole('button', { name: 'State: Open' }), {
    role: 'menuitemradio',
    name: 'Closed as not planned',
  })
  await backlog(run.page).getByRole('button', { name: 'State: Closed as not planned' }).waitFor()
  await openRoom(run.page, 'atlas')
  await openRoom(run.page, 'tickets')
  // The room draws its cached rows first and the read replaces them.
  await backlog(run.page).getByRole('button', { name: /^#273/ }).waitFor({ state: 'detached' })
  assert.deepEqual(await backlogKeys(run.page), ['#607', '#609'])
}

export async function proveDisconnect(run: Run) {
  await run.page.getByRole('button', { name: 'GitHub · octocat Connected' }).click()
  const octocat = accountRow(run.page, 'octocat')
  await press(octocat, 'Disconnect…')
  await press(octocat, 'Disconnect')
  await octocat.waitFor({ state: 'detached' })
  assert.equal((await storeText(run.fixture, 'grants.json')).includes('github:583231'), false)
  await press(accountsDialog(run.page), 'Close')
  await room(run).getByText('The GitHub Account for this repository is disconnected').waitFor()
  await press(room(run), 'Disconnect repository')
  await room(run).getByRole('heading', { name: 'Connect argo to a repository' }).waitFor()
}
