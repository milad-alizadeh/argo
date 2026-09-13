import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connect, harness, OCTOCAT } from './harness'

const WORK = { id: 9001, login: 'octocat-at-work' }

test('connecting GitHub adds one Account keyed by the provider id and opens only its own page', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  const connected = await connect(cockpit)
  assert.equal(connected.type, 'account.connected')
  assert.equal(connected.accountId, 'github:583231')
  assert.equal(connected.outcome, 'added')
  assert.deepEqual(connected.accounts, [
    { id: 'github:583231', provider: 'github', login: 'octocat', state: 'connected', bindings: [] },
  ])
  assert.deepEqual(cockpit.opened, [`${cockpit.github.origin}/login/device`])
})

test('the same identity signing in again renews its Account instead of adding one', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  cockpit.github.signIn({ ...OCTOCAT, login: 'octocat-renamed' })
  const again = await connect(cockpit)
  assert.equal(again.outcome, 'renewed')
  assert.deepEqual(
    (again.accounts as { id: string; login: string }[]).map(({ id, login }) => [id, login]),
    [['github:583231', 'octocat-renamed']],
  )
})

test('two identities stay two Accounts', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  cockpit.github.signIn(WORK)
  const second = await connect(cockpit)
  assert.equal(second.outcome, 'added')
  assert.deepEqual(
    (second.accounts as { id: string }[]).map((account) => account.id),
    ['github:583231', 'github:9001'],
  )
})

test('Accounts and the notice decision survive a restart', async (context) => {
  const cockpit = await harness(context)
  assert.equal((await cockpit.account('account.list')).notice, true)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  cockpit.restart()
  const listed = await cockpit.account('account.list')
  assert.equal(listed.notice, false)
  assert.equal((listed.accounts as unknown[]).length, 1)
})

test('dismissing the one-time notice keeps it dismissed', async (context) => {
  const cockpit = await harness(context)
  assert.equal((await cockpit.account('account.dismiss-notice')).notice, false)
  cockpit.restart()
  assert.equal((await cockpit.account('account.list')).notice, false)
})

test('disconnecting removes the Account and its grant', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  const after = await cockpit.account('account.disconnect', { accountId: 'github:583231' })
  assert.deepEqual(after.accounts, [])
  const again = await cockpit.account('account.disconnect', { accountId: 'github:583231' })
  assert.equal(again.code, 'missing-account')
})

test('a sign-in that ends without a grant says how it ended and stores nothing', async (context) => {
  const cockpit = await harness(context)
  for (const [answer, code] of [
    ['declined', 'sign-in-declined'],
    ['expired', 'sign-in-expired'],
  ] as const) {
    cockpit.github.signIn(answer)
    assert.equal((await connect(cockpit)).code, code)
  }
  assert.deepEqual((await cockpit.account('account.list')).accounts, [])
})

test('a cancelled sign-in answers the waiting step as cancelled', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT, 1_000_000)
  await cockpit.account('account.connect')
  const waiting = cockpit.account('account.await')
  await cockpit.account('account.cancel')
  assert.equal((await waiting).code, 'sign-in-cancelled')
  assert.equal((await cockpit.account('account.await')).code, 'no-sign-in')
})

test('a machine that cannot store a grant securely is refused before GitHub is called', async (context) => {
  const cockpit = await harness(context)
  cockpit.cipher.enabled = false
  assert.equal((await cockpit.account('account.connect')).code, 'secure-storage-unavailable')
  assert.deepEqual(cockpit.github.requests, [])
})

test('an unreachable GitHub is a named failure', async (context) => {
  const cockpit = await harness(context)
  await cockpit.github.close()
  assert.equal((await cockpit.account('account.connect')).code, 'github-unreachable')
})

test('an unknown action, a stray field and another version are refused by name', async (context) => {
  const cockpit = await harness(context)
  assert.equal((await cockpit.account('account.steal')).code, 'invalid-request')
  assert.equal((await cockpit.account('account.list', { token: 'x' })).code, 'invalid-request')
  const disconnect = await cockpit.account('account.disconnect')
  assert.equal(disconnect.code, 'invalid-request')
})
