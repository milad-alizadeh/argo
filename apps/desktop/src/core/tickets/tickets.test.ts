import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { markRevoked, tokenFor } from '../accounts/access'
import { connect, harness, OCTOCAT, PROJECT_ID } from '../accounts/harness'

const ACCOUNT = 'github:583231'

async function connected(context: TestContext) {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  cockpit.github.addRepository({
    fullName: 'Octo/Hello',
    visibleTo: [OCTOCAT.id],
    issues: [
      { number: 1, title: 'Parent', children: [2] },
      { number: 2, title: 'Child', body: 'Do it.', blockedBy: [3] },
      { number: 3, title: 'Done', state: 'closed' },
    ],
  })
  await connect(cockpit)
  return cockpit
}

test('a Binding is accepted only after GitHub shows the Account the repository', async (context) => {
  const cockpit = await connected(context)
  cockpit.github.addRepository({ fullName: 'octo/secret', visibleTo: [], issues: [] })
  cockpit.github.addRepository({
    fullName: 'octo/quiet',
    visibleTo: [OCTOCAT.id],
    issues: [],
    hasIssues: false,
  })
  for (const [scope, code] of [
    ['octo/secret', 'repository-not-visible'],
    ['octo/quiet', 'issues-disabled'],
    ['octo', 'invalid-scope'],
  ] as const) {
    assert.equal((await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope })).code, code)
  }
  assert.equal((await cockpit.ticket('ticket.binding')).binding, null)
  const bound = await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'octo/hello' })
  assert.deepEqual(bound.binding, {
    accountId: ACCOUNT,
    login: 'octocat',
    scope: 'Octo/Hello',
    state: 'ready',
  })
})

test('a bound Project lists its open Tickets with hierarchy and dependencies, after a restart too', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.restart()
  const listed = await cockpit.ticket('ticket.list')
  assert.equal(listed.type, 'ticket.listed')
  const tickets = listed.tickets as { number: number; children: unknown[]; blockedBy: unknown[] }[]
  assert.deepEqual(
    tickets.map((ticket) => ticket.number),
    [1, 2],
  )
  assert.deepEqual(tickets[0]?.children, [{ number: 2, title: 'Child', state: 'open' }])
  assert.deepEqual(tickets[1]?.blockedBy, [{ number: 3, title: 'Done', state: 'closed' }])
})

test('an unbound Project, or one no longer registered, is refused by name', async (context) => {
  const cockpit = await connected(context)
  assert.equal((await cockpit.ticket('ticket.list')).code, 'not-bound')
  const elsewhere = await cockpit.ticket('ticket.binding', { projectId: 'project-gone' })
  assert.equal(elsewhere.code, 'missing-project')
})

test('a revoked grant marks the Account and names the Bindings it affects', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.github.revoke('octocat')
  assert.equal((await cockpit.ticket('ticket.list')).code, 'account-revoked')
  const listed = await cockpit.account('account.list')
  assert.deepEqual(listed.accounts, [
    {
      id: ACCOUNT,
      provider: 'github',
      login: 'octocat',
      state: 'revoked',
      bindings: [{ projectId: PROJECT_ID, projectName: 'argo-demo', scope: 'Octo/Hello' }],
    },
  ])
  assert.equal(
    ((await cockpit.ticket('ticket.binding')).binding as { state: string }).state,
    'account-revoked',
  )
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  assert.equal((await cockpit.ticket('ticket.list')).type, 'ticket.listed')
})

test('a refusal of a grant renewed since leaves the Account connected', async (context) => {
  const cockpit = await connected(context)
  const before = await tokenFor(cockpit.access(), ACCOUNT)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  assert.ok(before.ok)
  await markRevoked(cockpit.access(), ACCOUNT, before.token)
  const accounts = (await cockpit.account('account.list')).accounts as { state: string }[]
  assert.equal(accounts[0]?.state, 'connected')
})

test('a disconnected Account leaves its Binding waiting for the same identity', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  await cockpit.account('account.disconnect', { accountId: ACCOUNT })
  const binding = (await cockpit.ticket('ticket.binding')).binding as { state: string }
  assert.equal(binding.state, 'account-missing')
  assert.equal((await cockpit.ticket('ticket.list')).code, 'missing-account')
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  assert.equal((await cockpit.ticket('ticket.list')).type, 'ticket.listed')
})

test('a throttled or unreachable GitHub is a visible failure and leaves the Account alone', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.github.outage('rate-limited')
  assert.equal((await cockpit.ticket('ticket.list')).code, 'rate-limited')
  cockpit.github.outage('down')
  assert.equal((await cockpit.ticket('ticket.list')).code, 'github-unreachable')
  const accounts = (await cockpit.account('account.list')).accounts as { state: string }[]
  assert.equal(accounts[0]?.state, 'connected')
})

test('unbinding forgets the repository', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.bind', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  assert.equal((await cockpit.ticket('ticket.unbind')).binding, null)
  assert.equal((await cockpit.ticket('ticket.list')).code, 'not-bound')
})
