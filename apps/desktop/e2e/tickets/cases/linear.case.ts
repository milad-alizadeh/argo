// The Ticket proof's Linear cases: the same packaged cockpit reading a Linear team through a mock
// Linear, beside a GitHub Account that no Linear failure may touch.
import assert from 'node:assert/strict'
import { test } from '@playwright/test'
import { ADA } from '../../../mocks/providers/linear/mock-linear-cast'
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
  room,
  signInToLinear,
  storeText,
} from '../screen'

const ada = (run: Run) => accountRow(run.page, ADA.name, 'Linear')
const teamKeys = (run: Run) => backlogKeys(run.page, /^ENG-\d+/)
const foot = (run: Run, state: string) =>
  run.page.getByRole('button', { name: `Linear · ${ADA.name} ${state}` })
const renewals = (run: Run) =>
  run.fixture.linear.requests.filter((request) => request === 'POST /oauth/token').length

async function assertSealed(run: Run) {
  const listing = await run.page.evaluate(() =>
    window.argo.listAccounts({ version: 1, type: 'account.list', requestId: 'proof' }),
  )
  for (const text of [JSON.stringify(listing), await storeText(run.fixture, 'grants.json')]) {
    assert.equal(text.includes('linear-access-'), false)
    assert.equal(text.includes('linear-refresh-'), false)
  }
}

export async function proveLinearConnect(run: Run) {
  await run.page.getByRole('button', { name: 'Accounts', exact: true }).click()
  const start = { scope: accountsDialog(run.page), name: 'Connect a Linear Account' }
  await test.step('linear-connect', async () => {
    assert.equal(await signInToLinear(run, start), `Connected ${ADA.name}.`)
    await ada(run).getByText(ADA.workspace).waitFor()
  })
  await test.step('linear-sealed-grant', () => assertSealed(run))
  await press(accountsDialog(run.page), 'Close')
  const form = connectForm(run.page)
  await chooseAccount(run.page, `Linear · ${ADA.name}`)
  const team = form.getByRole('combobox', { name: 'Team' })
  await test.step('linear-hidden-team', async () => {
    // Linear, not the form, decides which teams Ada can read, so a hidden team is never offered.
    await team.fill('Secret')
    await run.page.getByText('No team matches.').waitFor()
  })
  await test.step('linear-bind', async () => {
    await team.fill('Eng')
    await run.page.getByRole('option', { name: 'Engine' }).click()
    assert.equal(await team.inputValue(), 'Engine')
    await press(form, 'Connect team')
    await backlog(run.page).waitFor()
    assert.equal((await storeText(run.fixture, 'connections.json')).includes('team-engine'), true)
  })
}

// ENG-2 sits under ENG-1, and the done ENG-3 is only a closed blocker.
export async function proveLinearBacklog(run: Run) {
  await test.step('linear-list', async () => {
    assert.deepEqual(await teamKeys(run), ['ENG-1', 'ENG-2'])
    await backlog(run.page).getByRole('button', { name: 'Status: In Progress' }).waitFor()
  })
  await test.step('linear-detail', async () => {
    await backlog(run.page)
      .getByRole('button', { name: /^ENG-1/ })
      .click()
    const detail = run.page.getByRole('article', { name: 'Ticket ENG-1' })
    await detail.getByRole('heading', { name: 'Bind the mill' }).waitFor()
    await detail.getByText('The mill turns the cards.').waitFor()
    await detail.getByText('In Progress').waitFor()
    await detail.getByText('High').waitFor()
    await detail.getByRole('region', { name: 'Children · 0 of 1 closed' }).waitFor()
    await detail.getByRole('region', { name: 'Blocked by · 1' }).waitFor()
    await foot(run, 'Connected').waitFor()
    // Linear has no new-issue page Argo links to, so the sidebar offers none.
    assert.equal(await run.page.getByRole('button', { name: 'New Ticket' }).count(), 0)
  })
}

// Moving ENG-2 from its row reaches Linear, which the next launch reads back.
export async function proveLinearStatus(run: Run) {
  await test.step('linear-change-status', async () => {
    await choose(run.page, backlog(run.page).getByRole('button', { name: 'Status: Todo' }), {
      role: 'menuitemradio',
      name: 'In Progress',
    })
    await backlog(run.page).getByRole('button', { name: 'Status: In Progress' }).nth(1).waitFor()
  })
}

// A fresh launch unseals the grant, and the short-lived token is renewed before the first read.
export async function proveLinearRestart(run: Run) {
  await test.step('linear-restart-renewal', async () => {
    const before = renewals(run)
    await openRoom(run.page, 'tickets')
    assert.deepEqual(await teamKeys(run), ['ENG-1', 'ENG-2'])
    // ENG-2 kept the status it was moved to before the restart.
    const moved = backlog(run.page).getByRole('button', { name: 'Status: In Progress' })
    assert.equal(await moved.count(), 2)
    assert.ok(renewals(run) > before)
    await assertSealed(run)
  })
}

// Linear refuses the renewal: the Linear Account expires and its Connection waits, while the GitHub
// Account beside it stays connected. Signing in again brings the backlog back.
export async function proveLinearExpired(run: Run) {
  run.fixture.linear.refuseRefresh(ADA.id)
  await openRoom(run.page, 'atlas')
  await openRoom(run.page, 'tickets')
  await test.step('linear-refresh-failure', async () => {
    await room(run).getByText(`The sign-in for ${ADA.name} expired`).waitFor()
    await foot(run, 'Sign-in expired').click()
    await ada(run).getByText('Sign-in expired', { exact: true }).waitFor()
    await ada(run).getByText('Linear would not renew it', { exact: false }).waitFor()
    await ada(run)
      .getByRole('list', { name: `Teams for ${ADA.name}` })
      .getByText(/Engine/)
      .waitFor()
    await accountRow(run.page, 'hubot').getByText('Connected', { exact: true }).waitFor()
  })
  await test.step('linear-reconnect', async () => {
    const start = { scope: ada(run), name: 'Reconnect' }
    assert.equal(await signInToLinear(run, start), `Signed in again as ${ADA.name}.`)
    await press(accountsDialog(run.page), 'Close')
    assert.deepEqual(await teamKeys(run), ['ENG-1', 'ENG-2'])
  })
}

export async function proveLinearDisconnect(run: Run) {
  await test.step('linear-disconnect', async () => {
    await foot(run, 'Connected').click()
    await press(ada(run), 'Disconnect…')
    await press(ada(run), 'Disconnect')
    await ada(run).waitFor({ state: 'detached' })
    assert.equal((await storeText(run.fixture, 'grants.json')).includes('linear:user-ada'), false)
    await press(accountsDialog(run.page), 'Close')
    await room(run).getByText('The Linear Account for this team is disconnected').waitFor()
    await press(room(run), 'Disconnect team')
    await room(run).getByRole('heading', { name: 'Connect argo to a repository' }).waitFor()
  })
}
