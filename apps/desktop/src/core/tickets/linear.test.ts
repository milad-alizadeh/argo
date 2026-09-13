import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { ADA, HIDDEN, TEAM } from '../../providers/linear/harness'
import { connect, harness, LIST, OCTOCAT } from '../accounts/harness'

const ACCOUNT = 'linear:user-ada'
const BIND = { accountId: ACCOUNT, scope: TEAM.id }

async function connected(context: TestContext, lifetime = 86_399) {
  const cockpit = await harness(context)
  cockpit.linear.tokenLifetime(lifetime)
  cockpit.linear.addTeam(TEAM)
  cockpit.linear.addTeam(HIDDEN)
  cockpit.linear.signIn(ADA)
  assert.equal((await connect(cockpit, 'linear')).type, 'account.connected')
  return cockpit
}

async function bound(context: TestContext, lifetime?: number) {
  const cockpit = await connected(context, lifetime)
  await cockpit.ticket('ticket.connect', BIND)
  return cockpit
}

const states = async (cockpit: Awaited<ReturnType<typeof harness>>) =>
  ((await cockpit.account('account.list')).accounts as { id: string; state: string }[]).map(
    ({ id, state }) => [id, state],
  )

const tokenRequests = (cockpit: Awaited<ReturnType<typeof harness>>) =>
  cockpit.linear.requests.filter((line) => line === 'POST /oauth/token').length

test('connecting Linear adds an Account keyed by the Linear user, in its workspace', async (context) => {
  const cockpit = await connected(context)
  const listed = await cockpit.account('account.list')
  assert.deepEqual(listed.accounts, [
    {
      id: ACCOUNT,
      provider: 'linear',
      login: 'Ada Lovelace',
      workspace: 'Analytical',
      state: 'connected',
      connections: [],
    },
  ])
  assert.deepEqual(listed.providers, ['github', 'linear'])
  assert.equal(new URL(cockpit.opened[0] ?? '').pathname, '/oauth/authorize')
})

test('a team is connected only when Linear shows it to the Account', async (context) => {
  const cockpit = await connected(context)
  const hidden = await cockpit.ticket('ticket.connect', { accountId: ACCOUNT, scope: HIDDEN.id })
  assert.equal(hidden.code, 'team-not-visible')
  const discovered = await cockpit.ticket('ticket.discover', { accountId: ACCOUNT })
  assert.deepEqual(discovered.scopes, [{ scope: TEAM.id, label: 'Engine' }])
  const reply = await cockpit.ticket('ticket.connect', BIND)
  assert.deepEqual(reply.connection, {
    accountId: ACCOUNT,
    provider: 'linear',
    login: 'Ada Lovelace',
    scope: TEAM.id,
    label: 'Engine',
    state: 'ready',
  })
})

test('a bound team lists its open Tickets with Linear’s status, after a restart too', async (context) => {
  const cockpit = await bound(context)
  cockpit.restart()
  const listed = await cockpit.ticket('ticket.list', LIST)
  const tickets = listed.tickets as { key: string; status: { name: string } | null }[]
  assert.deepEqual(
    tickets.map(({ key, status }) => [key, status?.name]),
    [
      ['ENG-1', 'In Progress'],
      ['ENG-2', 'Todo'],
    ],
  )
})

// Inside the renewal margin: every read renews first.
const DUE = 60

test('a grant close to its expiry is renewed before the read', async (context) => {
  const cockpit = await bound(context, DUE)
  const before = tokenRequests(cockpit)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).type, 'ticket.listed')
  assert.ok(tokenRequests(cockpit) > before)
})

test('a token Linear refuses mid-life is renewed and the read retried', async (context) => {
  const cockpit = await bound(context)
  cockpit.linear.expire(ADA.id)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).type, 'ticket.listed')
  assert.deepEqual(await states(cockpit), [[ACCOUNT, 'connected']])
})

test('a refused renewal expires only that Account, until it reconnects', async (context) => {
  const cockpit = await bound(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  cockpit.linear.refuseRefresh(ADA.id)
  cockpit.linear.expire(ADA.id)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'account-expired')
  assert.deepEqual(await states(cockpit), [
    [ACCOUNT, 'expired'],
    ['github:583231', 'connected'],
  ])
  const connection = (await cockpit.ticket('ticket.connection')).connection as { state: string }
  assert.equal(connection.state, 'account-expired')
  cockpit.linear.signIn(ADA)
  await connect(cockpit, 'linear')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).type, 'ticket.listed')
})

test('a renewal Linear cannot answer is a named failure and the Account stays connected', async (context) => {
  const cockpit = await bound(context, DUE)
  cockpit.linear.outage('down')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'linear-unreachable')
  cockpit.linear.outage('rate-limited')
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'linear-rate-limited')
  assert.deepEqual(await states(cockpit), [[ACCOUNT, 'connected']])
})

test('a disconnected Linear Account leaves its team waiting, and unbinding forgets it', async (context) => {
  const cockpit = await bound(context)
  await cockpit.account('account.disconnect', { accountId: ACCOUNT })
  const connection = (await cockpit.ticket('ticket.connection')).connection as { state: string }
  assert.equal(connection.state, 'account-missing')
  assert.equal((await cockpit.ticket('ticket.disconnect')).connection, null)
  assert.equal((await cockpit.ticket('ticket.list', LIST)).code, 'not-connected')
})
