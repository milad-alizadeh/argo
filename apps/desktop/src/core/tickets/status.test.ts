import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import type { MockIssue } from '../../../mocks/providers/github/mock-github'
import { ADA, HIDDEN, TEAM } from '../../providers/linear/harness'
import { connect, harness, LIST, OCTOCAT } from '../accounts/harness'

const HUBOT = { id: 2, login: 'hubot' }

// octo/hello, whose issues Octocat can change and Hubot can only read.
async function github(context: TestContext, user = OCTOCAT) {
  const cockpit = await harness(context)
  const issues: MockIssue[] = [
    { number: 1, title: 'Keep' },
    { number: 2, title: 'Drop' },
  ]
  cockpit.github.signIn(user)
  const readers = [OCTOCAT.id, HUBOT.id]
  cockpit.github.addRepository({
    fullName: 'octo/hello',
    visibleTo: readers,
    writers: [OCTOCAT.id],
    issues,
  })
  await connect(cockpit)
  const accountId = `github:${user.id}`
  await cockpit.ticket('ticket.connect', { accountId, scope: 'octo/hello' })
  return { cockpit, issues }
}

async function linear(context: TestContext) {
  const cockpit = await harness(context)
  cockpit.linear.addTeam(structuredClone(TEAM))
  cockpit.linear.addTeam(HIDDEN)
  cockpit.linear.signIn(ADA)
  await connect(cockpit, 'linear')
  await cockpit.ticket('ticket.connect', { accountId: 'linear:user-ada', scope: TEAM.id })
  return cockpit
}

const keys = async (cockpit: Awaited<ReturnType<typeof harness>>) =>
  ((await cockpit.ticket('ticket.list', LIST)).tickets as { key: string }[]).map(({ key }) => key)

test('GitHub offers open and its three reasons for closing', async (context) => {
  const { cockpit } = await github(context)
  const listed = await cockpit.ticket('ticket.list', LIST)
  assert.deepEqual(
    (listed.statuses as { id: string }[]).map(({ id }) => id),
    ['open', 'completed', 'not_planned', 'duplicate'],
  )
})

test('closing a GitHub Ticket as not planned closes it with that reason', async (context) => {
  const { cockpit, issues } = await github(context)
  const reply = await cockpit.ticket('ticket.update', { key: '#2', statusId: 'not_planned' })
  assert.deepEqual(reply.status, {
    id: 'not_planned',
    name: 'Closed as not planned',
    category: 'canceled',
  })
  assert.deepEqual([issues[1]?.state, issues[1]?.stateReason], ['closed', 'not_planned'])
  assert.deepEqual(await keys(cockpit), ['#1'])
})

test('a GitHub Account that can only read the repository cannot change its Tickets', async (context) => {
  const { cockpit, issues } = await github(context, HUBOT)
  const reply = await cockpit.ticket('ticket.update', { key: '#2', statusId: 'completed' })
  assert.equal(reply.code, 'ticket-not-writable')
  assert.equal(issues[1]?.state, undefined)
})

test('a GitHub Ticket that is gone, or a status GitHub lacks, is refused', async (context) => {
  const { cockpit } = await github(context)
  for (const [key, statusId, code] of [
    ['#9', 'completed', 'ticket-not-found'],
    ['#1', 'In Progress', 'status-unknown'],
  ] as const) {
    assert.equal((await cockpit.ticket('ticket.update', { key, statusId })).code, code)
  }
})

test('a GitHub Ticket has no priority to change', async (context) => {
  const { cockpit } = await github(context)
  const reply = await cockpit.ticket('ticket.priority', { key: '#1', priorityLevel: 1 })
  assert.equal(reply.code, 'ticket-not-writable')
})

test('moving a Linear Ticket to Done writes it in Linear and it leaves the backlog', async (context) => {
  const cockpit = await linear(context)
  const reply = await cockpit.ticket('ticket.update', {
    key: 'ENG-2',
    statusId: 'team-engine-done',
  })
  assert.deepEqual(reply.status, { id: 'team-engine-done', name: 'Done', category: 'completed' })
  assert.deepEqual(await keys(cockpit), ['ENG-1'])
})

test('a Linear state of another team is refused before anything is written', async (context) => {
  const cockpit = await linear(context)
  const reply = await cockpit.ticket('ticket.update', {
    key: 'ENG-2',
    statusId: 'team-hidden-done',
  })
  assert.equal(reply.code, 'status-unknown')
  assert.deepEqual(await keys(cockpit), ['ENG-1', 'ENG-2'])
})

test('a Linear Ticket can move from High to Urgent, and from Urgent to No priority', async (context) => {
  const cockpit = await linear(context)
  const toUrgent = await cockpit.ticket('ticket.priority', { key: 'ENG-1', priorityLevel: 1 })
  assert.deepEqual(toUrgent.priority, { level: 1, label: 'Urgent' })
  const toNone = await cockpit.ticket('ticket.priority', { key: 'ENG-1', priorityLevel: null })
  assert.equal(toNone.priority, null)
})

test('a Linear issue of another team is refused a priority change', async (context) => {
  const cockpit = await harness(context)
  cockpit.linear.addTeam(structuredClone(TEAM))
  cockpit.linear.addTeam({
    ...structuredClone(HIDDEN),
    visibleTo: [ADA.id],
    issues: [{ identifier: 'SEC-1', title: 'Secret work', status: 'Todo', stateType: 'unstarted' }],
  })
  cockpit.linear.signIn(ADA)
  await connect(cockpit, 'linear')
  await cockpit.ticket('ticket.connect', { accountId: 'linear:user-ada', scope: TEAM.id })
  const reply = await cockpit.ticket('ticket.priority', { key: 'SEC-1', priorityLevel: 1 })
  assert.equal(reply.code, 'ticket-not-found')
})
