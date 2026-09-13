import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import type { FakeLinearTeam } from './fake-driver/fake-linear'
import { ADA, HIDDEN, linear, signIn, TEAM } from './harness'
import { readTicketPage } from './issues'
import { checkTeam, listTeams } from './teams'

const BACKLOG = { scope: TEAM.id, query: '', cursor: null }

// Ada signed in to a fake Linear serving these teams.
async function signedIn(context: TestContext, teams: FakeLinearTeam[]) {
  const [fake, endpoints] = await linear(context)
  for (const team of teams) fake.addTeam(team)
  fake.signIn(ADA)
  const { accessToken } = await signIn(endpoints)
  return { fake, endpoints, accessToken }
}

test('a Ticket carries Linear’s own fields, children and blockers', async (context) => {
  const { fake, endpoints, accessToken } = await signedIn(context, [TEAM])
  const page = await readTicketPage(endpoints, accessToken, BACKLOG)
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.tickets.map((ticket) => ticket.key),
    ['ENG-1', 'ENG-2'],
  )
  assert.deepEqual(page.value.tickets[0], {
    key: 'ENG-1',
    url: `${fake.origin}/Analytical/issue/ENG-1`,
    title: 'Bind the mill',
    body: 'The mill turns the cards.',
    state: 'open',
    status: { id: 'team-engine-in-progress', name: 'In Progress', category: 'started' },
    priority: { level: 2, label: 'High' },
    createdAt: '2026-09-02T10:00:00.000Z',
    labels: [{ name: 'Engine', color: '5e6ad2' }],
    type: null,
    children: [{ key: 'ENG-2', title: 'Cut the cards', state: 'open' }],
    blockedBy: [{ key: 'ENG-3', title: 'Cast the gears', state: 'closed' }],
  })
  assert.equal(page.value.tickets[1]?.priority, null)
})

test('a page offers the team’s statuses in the order Linear’s board draws them', async (context) => {
  const { endpoints, accessToken } = await signedIn(context, [TEAM])
  const page = await readTicketPage(endpoints, accessToken, BACKLOG)
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.statuses.map(({ name, category }) => [name, category]),
    [
      ['Backlog', 'backlog'],
      ['Todo', 'unstarted'],
      ['In Progress', 'started'],
      ['Done', 'completed'],
      ['Canceled', 'canceled'],
    ],
  )
})

test('a search reads matching open Tickets and counts them', async (context) => {
  const { endpoints, accessToken } = await signedIn(context, [TEAM])
  const page = await readTicketPage(endpoints, accessToken, { ...BACKLOG, query: 'cards' })
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.tickets.map((ticket) => ticket.key),
    ['ENG-1', 'ENG-2'],
  )
  assert.equal(page.value.total, 2)
})

test('a backlog longer than a page is read on by its cursor', async (context) => {
  const issues = Array.from({ length: 30 }, (_, index) => ({
    identifier: `ENG-${index + 1}`,
    title: `Step ${index + 1}`,
  }))
  const { endpoints, accessToken } = await signedIn(context, [{ ...TEAM, issues }])
  const first = await readTicketPage(endpoints, accessToken, BACKLOG)
  assert.ok(first.ok && first.value.nextCursor)
  assert.equal(first.value.tickets.length, 25)
  const second = await readTicketPage(endpoints, accessToken, {
    ...BACKLOG,
    cursor: first.value.nextCursor,
  })
  assert.ok(second.ok)
  assert.deepEqual(
    second.value.tickets.map((ticket) => ticket.key),
    ['ENG-26', 'ENG-27', 'ENG-28', 'ENG-29', 'ENG-30'],
  )
  assert.equal(second.value.nextCursor, null)
})

test('a team is checked against the teams the Account can see', async (context) => {
  const { endpoints, accessToken } = await signedIn(context, [TEAM, HIDDEN])
  assert.deepEqual(await listTeams(endpoints, accessToken), {
    ok: true,
    value: [{ id: TEAM.id, key: 'ENG', name: 'Engine' }],
  })
  assert.deepEqual(await checkTeam(endpoints, accessToken, TEAM.id), {
    ok: true,
    team: { id: TEAM.id, key: 'ENG', name: 'Engine' },
  })
  assert.deepEqual(await checkTeam(endpoints, accessToken, HIDDEN.id), {
    ok: false,
    failure: 'team-not-visible',
  })
})

test('Linear’s refusals and outages become the failure the cockpit names', async (context) => {
  const { fake, endpoints, accessToken } = await signedIn(context, [TEAM])
  const read = () => readTicketPage(endpoints, accessToken, BACKLOG)
  fake.outage('rate-limited')
  assert.deepEqual(await read(), { ok: false, failure: 'rate-limited' })
  fake.outage('down')
  assert.deepEqual(await read(), { ok: false, failure: 'unreachable' })
  fake.outage('none')
  fake.revoke(ADA.id)
  assert.deepEqual(await read(), { ok: false, failure: 'unauthorized' })
})

test('an access token past its lifetime is refused as unauthorized', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn(ADA)
  const { accessToken } = await signIn(endpoints)
  fake.expire(ADA.id)
  assert.deepEqual(await listTeams(endpoints, accessToken), { ok: false, failure: 'unauthorized' })
})
