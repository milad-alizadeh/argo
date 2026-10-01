// The Ticket proof's connection and backlog cases, read off the screen of the packaged app and
// then off the files its main process wrote. GitHub is the mock; everything else is the shipped
// app. Its account lifecycle cases are `lifecycle.case.ts`, and Linear's are
// `linear.case.ts`.
import assert from 'node:assert/strict'
import { expect, test } from '@playwright/test'
import {
  helloWorldRepository as helloWorld,
  hubotUser,
  octocatUser,
} from '@/mocks/tickets/provider-inputs'
import {
  accountListing,
  accountRow,
  accountsDialog,
  backlog,
  backlogKeys,
  choose,
  chooseAccount,
  committedTicketIds,
  connectForm,
  detailTitle,
  notification,
  openRoom,
  press,
  type Run,
  room,
  signIn,
  storeText,
} from '../screen'

const UNRECONCILED = 'This Ticket has an unresolved change. Try again once Argo confirms it.'

const GITHUB_SCOPE = { provider: 'github', scope: 'octocat/hello-world' }

export async function proveConnect(run: Run) {
  await openRoom(run.page, 'tickets')
  await run.page.getByText('Connect an Account to read Tickets').waitFor()
  const start = { scope: accountsDialog(run.page), name: 'Connect a GitHub Account' }
  await press(room(run), 'Connect an Account')
  await test.step('connect', async () => {
    assert.equal(await signIn(run, octocatUser(), start), 'Connected octocat.')
  })
  // The same GitHub identity signs in again as the one Account; another identity is another.
  await test.step('same-identity', async () => {
    assert.equal(await signIn(run, octocatUser(), start), 'Signed in again as octocat.')
  })
  await test.step('second-identity', async () => {
    assert.equal(await signIn(run, hubotUser(), start), 'Connected hubot.')
    await accountRow(run.page, 'hubot').waitFor()
  })
  await test.step('sealed-grant', async () => {
    const rows = accountsDialog(run.page).getByRole('listitem', { name: /^GitHub Account / })
    assert.equal(await rows.count(), 2)
    // The grant is sealed on disk, and nothing the renderer can ask for carries it.
    const listing = await accountListing(run.page)
    for (const text of [JSON.stringify(listing), await storeText(run.fixture, 'grants.json')]) {
      assert.equal(text.includes('token-'), false)
    }
    assert.equal((await storeText(run.fixture, 'accounts.json')).includes('token-'), false)
  })
  await test.step('repository-form-inline', async () => {
    // The repository-connect form draws inside the Accounts dialog once an Account connects (#2411).
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
    await detailTitle(detail, 'Wayfinder: the Tickets room, end to end').waitFor()
    await detail.getByText('The backlog in the deck and the Ticket beside it.').waitFor()
    await detail.getByText('wayfinder', { exact: true }).waitFor()
    await detail.getByRole('heading', { name: 'Children · 1 of 2 closed' }).waitFor()
    await detail.getByRole('heading', { name: 'Blocked by · 1' }).waitFor()
  })
}

// With GitHub reads held, the backlog draws committed rows; a new Ticket waits for its commit.
export async function proveCommittedBacklog(run: Run) {
  const github = run.fixture.github
  let committed: Record<string, string> = {}
  await test.step('committed', async () => {
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    committed = committedTicketIds(run, GITHUB_SCOPE)
    assert.deepEqual(Object.keys(committed).sort(), ['#273', '#607', '#609'])
  })
  const release = github.holdReads()
  try {
    await test.step('drawn-from-sqlite', async () => {
      const repository = helloWorld()
      repository.issues.push({ number: 710, title: 'Created on GitHub' })
      github.addRepository(repository)
      await openRoom(run.page, 'atlas')
      await openRoom(run.page, 'tickets')
      assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
      await expect(backlog(run.page).getByRole('button', { name: /^#710/ })).toHaveCount(0)
    })
  } finally {
    release()
  }
  await test.step('external-ticket', async () => {
    await backlog(run.page).getByRole('button', { name: /^#710/ }).waitFor()
    const later = committedTicketIds(run, GITHUB_SCOPE)
    for (const key of Object.keys(committed)) assert.equal(later[key], committed[key])
    assert.ok(later['#710'])
  })
}

// A fresh launch has no renderer cache, so a backlog drawn while GitHub holds every read is SQLite's.
export async function proveRestartFromSqlite(run: Run, release: () => void) {
  await test.step('restart-from-sqlite', async () => {
    await openRoom(run.page, 'tickets')
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    release()
  })
}

// GitHub keeps no priority, so no row offers a control for one.
export async function proveGitHubNoPriority(run: Run) {
  await test.step('github-no-priority', async () => {
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    assert.equal(
      await backlog(run.page)
        .getByRole('button', { name: /^Priority:/ })
        .count(),
      0,
    )
  })
}

const REFUSED = 'This Account is not allowed to change that Ticket.'
// #273 is the last row, so its status control is the last one drawn.
const lastStatus = (run: Run, name: string) =>
  backlog(run.page)
    .getByRole('button', { name: `State: ${name}` })
    .last()

// Opens #273's status menu and picks "Closed as completed", the change every case below sends.
const closeAsCompleted = (run: Run) =>
  choose(run.page, lastStatus(run, 'Open'), {
    role: 'menuitemradio',
    name: 'Closed as completed',
  })

// Closing #273 from its row reaches GitHub, and the row then shows the status GitHub confirmed.
export async function proveGitHubStatus(run: Run) {
  await test.step('github-change-status', async () => {
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    await closeAsCompleted(run)
    await lastStatus(run, 'Closed as completed').waitFor()
    assert.ok(run.fixture.github.requests.includes('PATCH /repos/octocat/hello-world/issues/273'))
  })
}

// GitHub refuses the change: the row keeps its status, and the reader is told why.
export async function proveGitHubStatusRefused(run: Run) {
  run.fixture.github.addRepository({ ...helloWorld(), writers: [] })
  await test.step('github-refused-status', async () => {
    await closeAsCompleted(run)
    await notification(run.page).getByText(REFUSED).waitFor()
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    assert.equal(await backlog(run.page).getByRole('button', { name: 'State: Open' }).count(), 3)
  })
}

// GitHub is down for the write: the change is left uncertain, sent once, and a second attempt is
// refused locally until it settles (#2878).
export async function proveGitHubStatusUncertain(run: Run) {
  run.fixture.github.outage('down')
  await test.step('write-left-uncertain', async () => {
    await closeAsCompleted(run)
    await notification(run.page).getByText('Argo cannot reach GitHub.').waitFor()
    await lastStatus(run, 'Open').waitFor()
  })
  await test.step('blocked-until-reconciled', async () => {
    await closeAsCompleted(run)
    await notification(run.page).getByText(UNRECONCILED).waitFor()
    assert.equal(
      run.fixture.github.requests.filter(
        (request) => request === 'PATCH /repos/octocat/hello-world/issues/273',
      ).length,
      1,
    )
  })
  run.fixture.github.outage('none')
}

// A restart reads the uncertain write's Ticket by native ID: GitHub never applied it, so the row
// stays Open and a new change is no longer blocked (#2878).
export async function proveRestartReconcilesUncertainStatus(run: Run) {
  await openRoom(run.page, 'tickets')
  await lastStatus(run, 'Open').waitFor()
  await closeAsCompleted(run)
  await lastStatus(run, 'Closed as completed').waitFor()
  assert.ok(run.fixture.github.requests.includes('PATCH /repos/octocat/hello-world/issues/273'))
}

// A list read GitHub answered before the change cannot put #273 back to Open when it lands after.
export async function proveStaleListKeepsConfirmedStatus(run: Run) {
  const github = run.fixture.github
  const asked = () =>
    github.requests.filter((request) => request === 'GET /repos/octocat/hello-world/issues').length
  const release = github.holdStaleReads()
  try {
    await openRoom(run.page, 'atlas')
    const before = asked()
    await openRoom(run.page, 'tickets')
    await expect.poll(asked).toBeGreaterThan(before)
    await choose(run.page, lastStatus(run, 'Open'), {
      role: 'menuitemradio',
      name: 'Closed as completed',
    })
    await lastStatus(run, 'Closed as completed').waitFor()
  } finally {
    release()
  }
  await test.step('stale-list-lands', async () => {
    await expect(backlog(run.page).getByText(/^Refreshing from/)).toHaveCount(0)
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
    await lastStatus(run, 'Closed as completed').waitFor()
  })
}
