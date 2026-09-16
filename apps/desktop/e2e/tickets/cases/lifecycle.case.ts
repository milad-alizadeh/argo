// The Ticket proof's GitHub Account lifecycle cases: a restart against a down GitHub, a revoked
// grant, a Ticket's state changing on GitHub, and disconnecting the Account and the repository.
// The initial connection and backlog cases are `github.case.ts`.
import assert from 'node:assert/strict'
import { test } from '@playwright/test'
import { OCTOCAT } from '../fixtures/tickets.fixture'
import {
  accountRow,
  accountsDialog,
  backlog,
  backlogKeys,
  choose,
  openRoom,
  press,
  type Run,
  room,
  signIn,
  storeText,
} from '../screen'

// A fresh launch reads the sealed grant back. GitHub is down for it, so the failure is on screen,
// and reading again once GitHub answers draws the same backlog.
export async function proveRestartAndFailure(run: Run) {
  await openRoom(run.page, 'tickets')
  const failure = room(run).getByRole('alert').filter({ hasText: 'Unable to read Tickets' })
  await test.step('visible-failure', async () => {
    await failure.getByText('Argo cannot reach GitHub.').waitFor()
    assert.equal(await run.page.getByRole('region', { name: 'Sign-in notice' }).count(), 0)
  })
  await test.step('restart', async () => {
    run.fixture.github.outage('none')
    await press(failure, 'Try again')
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
  })
}

export async function proveRevoked(run: Run) {
  run.fixture.github.revoke('octocat')
  await openRoom(run.page, 'atlas')
  await openRoom(run.page, 'tickets')
  await test.step('revoked-access', async () => {
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
  })
  await test.step('reconnect', async () => {
    const octocat = accountRow(run.page, 'octocat')
    const start = { scope: octocat, name: 'Reconnect' }
    assert.equal(await signIn(run, OCTOCAT, start), 'Signed in again as octocat.')
    await press(accountsDialog(run.page), 'Close')
    assert.deepEqual(await backlogKeys(run.page), ['#607', '#609', '#273'])
  })
}

// Closing #273 as not planned from its Detail reaches GitHub: the next read leaves it out.
export async function proveChangeState(run: Run) {
  await test.step('change-state', async () => {
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
  })
}

export async function proveDisconnect(run: Run) {
  await run.page.getByRole('button', { name: 'GitHub · octocat Connected' }).click()
  const octocat = accountRow(run.page, 'octocat')
  await test.step('disconnect', async () => {
    await press(octocat, 'Disconnect…')
    await press(octocat, 'Disconnect')
    await octocat.waitFor({ state: 'detached' })
    assert.equal((await storeText(run.fixture, 'grants.json')).includes('github:583231'), false)
    await press(accountsDialog(run.page), 'Close')
  })
  await test.step('disconnectSource', async () => {
    await room(run).getByText('The GitHub Account for this repository is disconnected').waitFor()
    await press(room(run), 'Disconnect repository')
    await room(run).getByRole('heading', { name: 'Connect argo to a repository' }).waitFor()
  })
}
