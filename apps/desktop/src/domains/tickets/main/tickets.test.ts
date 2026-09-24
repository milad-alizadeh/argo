import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import {
  connect,
  harness,
  LIST,
  OCTOCAT,
  PROJECT_ID,
} from '@/domains/accounts/main/test-support/harness'

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

// Beside the connectable repository: one the Account cannot see, and one with Issues turned off.
async function withUnreadable(context: TestContext) {
  const cockpit = await connected(context)
  cockpit.github.addRepository({ fullName: 'octo/secret', visibleTo: [], issues: [] })
  cockpit.github.addRepository({
    fullName: 'octo/quiet',
    visibleTo: [OCTOCAT.id],
    issues: [],
    hasIssues: false,
  })
  return cockpit
}

test('a Connection is accepted only after GitHub shows the Account the repository', async (context) => {
  const cockpit = await withUnreadable(context)
  for (const [scope, code] of [
    ['octo/secret', 'repository-not-visible'],
    ['octo/quiet', 'issues-disabled'],
    ['octo', 'invalid-scope'],
  ] as const) {
    assert.equal((await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope })).code, code)
  }
  assert.equal((await cockpit.ticket('ticket.connection')).connection, null)
  const reply = await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'octo/hello' })
  assert.deepEqual(reply.connection, {
    accountId: ACCOUNT,
    provider: 'github',
    login: 'octocat',
    scope: 'Octo/Hello',
    label: 'Octo/Hello',
    state: 'ready',
  })
})

test('an Account offers only the repositories it can see that source Tickets', async (context) => {
  const cockpit = await withUnreadable(context)
  cockpit.github.addRepository({ fullName: 'Hubot/Arm', visibleTo: [OCTOCAT.id], issues: [] })
  const reply = await cockpit.ticket('ticket.discover', { accountId: ACCOUNT })
  assert.equal(reply.type, 'ticket.discovered')
  assert.deepEqual(
    (reply.scopes as { scope: string }[]).map(({ scope }) => scope),
    ['Hubot/Arm', 'Octo/Hello'],
  )
})

test('an Account GitHub refuses offers no repositories and is marked revoked', async (context) => {
  const cockpit = await connected(context)
  cockpit.github.revoke('octocat')
  assert.equal(
    (await cockpit.ticket('ticket.discover', { accountId: ACCOUNT })).code,
    'account-revoked',
  )
  const accounts = (await cockpit.account('account.list')).accounts as { state: string }[]
  assert.equal(accounts[0]?.state, 'revoked')
})

test('a connected Project lists its open Tickets with hierarchy and dependencies, after a restart too', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.restart()
  const listed = await cockpit.ticket('ticket.list', LIST)
  assert.equal(listed.type, 'ticket.listed')
  const tickets = listed.tickets as { key: string; children: unknown[]; blockedBy: unknown[] }[]
  assert.deepEqual(
    tickets.map((ticket) => ticket.key),
    ['#1', '#2'],
  )
  assert.deepEqual(tickets[0]?.children, [{ key: '#2', title: 'Child', state: 'open' }])
  assert.deepEqual(tickets[1]?.blockedBy, [{ key: '#3', title: 'Done', state: 'closed' }])
})

test('a Ticket route reads a closed GitHub Ticket by key', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })

  const read = await cockpit.ticket('ticket.read', { key: '#3' })

  assert.equal(read.type, 'ticket.read')
  const ticket = read.ticket as { key: string; title: string; state: string }
  assert.equal(ticket.key, '#3')
  assert.equal(ticket.title, 'Done')
  assert.equal(ticket.state, 'closed')
})

test('an unconnected Project, or one no longer registered, is refused by name', async (context) => {
  const cockpit = await connected(context)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'not-connected')
  const elsewhere = await cockpit.ticket('ticket.connection', { projectId: 'project-gone' })
  assert.equal(elsewhere.code, 'missing-project')
})

test('a revoked grant marks the Account and names the Connections it affects', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.github.revoke('octocat')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'account-revoked')
  const listed = await cockpit.account('account.list')
  assert.deepEqual(listed.accounts, [
    {
      id: ACCOUNT,
      provider: 'github',
      login: 'octocat',
      workspace: null,
      state: 'revoked',
      connections: [{ projectId: PROJECT_ID, projectName: 'argo-demo', label: 'Octo/Hello' }],
    },
  ])
  assert.equal(
    ((await cockpit.ticket('ticket.connection')).connection as { state: string }).state,
    'account-revoked',
  )
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).type, 'ticket.listed')
})

test('a disconnected Account leaves its Connection waiting for the same identity', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  await cockpit.account('account.disconnect', { accountId: ACCOUNT })
  const connection = (await cockpit.ticket('ticket.connection')).connection as { state: string }
  assert.equal(connection.state, 'account-missing')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'missing-account')
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).type, 'ticket.listed')
})

test('a throttled or unreachable GitHub is a visible failure and leaves the Account alone', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  cockpit.github.outage('rate-limited')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'rate-limited')
  cockpit.github.outage('down')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'github-unreachable')
  const accounts = (await cockpit.account('account.list')).accounts as { state: string }[]
  assert.equal(accounts[0]?.state, 'connected')
})

test('disconnecting forgets the repository', async (context) => {
  const cockpit = await connected(context)
  await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: 'Octo/Hello' })
  assert.equal((await cockpit.ticket('ticket.disconnect')).connection, null)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'not-connected')
})
