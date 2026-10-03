import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { ticket } from '@/domains/tickets/api/ticket'
import { ADA, HIDDEN, linear, signIn, TEAM } from '@/providers/linear/harness'
import { readTicket, readTicketPage } from '@/providers/linear/issues'
import { checkTeam, listTeams } from '@/providers/linear/teams'
import { isRecord } from '@/shared/validation'
import type { MockLinearTeam } from '../../../mocks/providers/linear/mock-linear'
import { assertUnstubbedRequestFails } from '../../../mocks/providers/msw-node-bridge'

const BACKLOG = { scope: TEAM.id, query: '', cursor: null }

// Ada signed in to a mock Linear serving these teams.
async function signedIn(context: TestContext, teams: MockLinearTeam[]) {
  const [mock, endpoints] = await linear(context)
  for (const team of teams) mock.addTeam(team)
  mock.signIn(ADA)
  const { accessToken } = await signIn(endpoints)
  return { mock, endpoints, accessToken }
}

test('a Ticket carries Linear’s own fields, children and blockers', async (context) => {
  const { mock, endpoints, accessToken } = await signedIn(context, [TEAM])
  const page = await readTicketPage(endpoints, accessToken, BACKLOG)
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.tickets.map((ticket) => ticket.key),
    ['ENG-1', 'ENG-2'],
  )
  assert.deepEqual(page.value.tickets[0], {
    key: 'ENG-1',
    nativeId: 'issue-ENG-1',
    url: `${mock.origin}/Analytical/issue/ENG-1`,
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

test('Linear’s refusals and outages become the failure the app names', async (context) => {
  const { mock, endpoints, accessToken } = await signedIn(context, [TEAM])
  const read = () => readTicketPage(endpoints, accessToken, BACKLOG)
  mock.outage('rate-limited')
  assert.deepEqual(await read(), { ok: false, failure: 'rate-limited' })
  mock.outage('down')
  assert.deepEqual(await read(), { ok: false, failure: 'unreachable' })
  mock.outage('none')
  mock.revoke(ADA.id)
  assert.deepEqual(await read(), { ok: false, failure: 'unauthorized' })
})

test('an access token past its lifetime is refused as unauthorized', async (context) => {
  const [mock, endpoints] = await linear(context)
  mock.signIn(ADA)
  const { accessToken } = await signIn(endpoints)
  mock.expire(ADA.id)
  assert.deepEqual(await listTeams(endpoints, accessToken), { ok: false, failure: 'unauthorized' })
})

test('a call to a route this mock never stubbed fails loudly, naming the request', async (context) => {
  const [mock] = await linear(context)
  await assertUnstubbedRequestFails(`${mock.origin}/oauth/revoke`)
})

test('a Closed page lists only the completed and canceled issues', async (context) => {
  const { endpoints, accessToken } = await signedIn(context, [TEAM])
  const page = await readTicketPage(endpoints, accessToken, { ...BACKLOG, state: 'closed' })
  assert.ok(page.ok)
  assert.deepEqual(
    page.value.tickets.map((ticket) => [ticket.key, ticket.state]),
    [['ENG-3', 'closed']],
  )
  assert.equal(page.value.nextCursor, null)
})

test('one issue reads by key or id, closed included, only within the connected team', async (context) => {
  const other: MockLinearTeam = { ...HIDDEN, id: 'team-other', visibleTo: [ADA.id] }
  const { endpoints, accessToken } = await signedIn(context, [TEAM, other])
  for (const id of ['ENG-3', 'issue-ENG-3']) {
    const read = await readTicket(endpoints, accessToken, { scope: TEAM.id, id })
    assert.ok(read.ok)
    assert.equal(read.value.nativeId, 'issue-ENG-3')
    assert.equal(read.value.state, 'closed')
  }
  // Another team's issue is not this team's; no issue at all is only absent until the team is seen.
  const elsewhere = { scope: 'team-other', id: 'ENG-3' }
  assert.deepEqual(await readTicket(endpoints, accessToken, elsewhere), {
    ok: false,
    failure: 'ticket-not-found',
  })
  assert.deepEqual(await readTicket(endpoints, accessToken, { scope: TEAM.id, id: 'ENG-404' }), {
    ok: false,
    failure: 'ticket-absent',
  })
})

function replaceLabels(body: unknown, labelConnection: unknown) {
  assert.ok(isRecord(body) && isRecord(body.data))
  const connection = body.data.issues
  const issues =
    isRecord(connection) && Array.isArray(connection.nodes) ? connection.nodes : [body.data.issue]
  for (const issue of issues) {
    assert.ok(isRecord(issue))
    if (issue.identifier === 'ENG-1') issue.labels = labelConnection
  }
}

const normalizedDiagnosticLabels = [
  { name: 'black', color: '000000' },
  { name: 'white', color: 'FFFFFF' },
  { name: 'missing', color: null },
  { name: 'nullable', color: null },
  { name: 'private-label', color: null },
  { name: 'number-color', color: null },
]

test('Linear label reads retain valid names and report per-response rejection counts', async (context) => {
  const { endpoints, accessToken } = await signedIn(context, [TEAM])
  let labelConnection: unknown = {
    nodes: [
      { name: 'black', color: '000000' },
      { name: 'white', color: '#FFFFFF' },
      { name: 'missing' },
      { name: 'nullable', color: null },
      { name: 'private-label', color: 'var(--private)' },
      { name: 'number-color', color: 7 },
      'unsupported record',
      { name: 8 },
    ],
  }
  const originalFetch = globalThis.fetch
  const originalWarning = console.warn
  const warnings: string[] = []
  console.warn = (...values: unknown[]) => warnings.push(values.join(' '))
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const response = await originalFetch(input, init)
      if (String(input) !== `${endpoints.api}/graphql`) return response
      const body: unknown = await response.json()
      replaceLabels(body, labelConnection)
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      })
    },
    { preconnect: originalFetch.preconnect },
  )
  try {
    const page = await readTicketPage(endpoints, accessToken, BACKLOG)
    assert.ok(page.ok)
    assert.deepEqual(page.value.tickets[0]?.labels, normalizedDiagnosticLabels)
    assert.ok(ticket.safeParse(page.value.tickets[0]).success)
    const single = await readTicket(endpoints, accessToken, { scope: TEAM.id, id: 'ENG-1' })
    assert.ok(single.ok)
    assert.deepEqual(single.value.labels, normalizedDiagnosticLabels)
    assert.ok(ticket.safeParse(single.value).success)
    const rejection =
      'Linear Ticket labels: rejected 2 labels.nodes[] record(s), 2 labels.nodes[].color value(s).'
    assert.deepEqual(warnings, [rejection, rejection])
    labelConnection = { nodes: 'private malformed collection' }
    const malformed = await readTicketPage(endpoints, accessToken, BACKLOG)
    assert.ok(malformed.ok)
    assert.deepEqual(malformed.value.tickets[0]?.labels, [])
    assert.equal(
      warnings[2],
      'Linear Ticket labels: rejected 1 labels.nodes[] record(s), 0 labels.nodes[].color value(s).',
    )
    labelConnection = undefined
    const missing = await readTicket(endpoints, accessToken, { scope: TEAM.id, id: 'ENG-1' })
    assert.ok(missing.ok)
    assert.deepEqual(missing.value.labels, [])
    assert.equal(warnings.length, 3)
  } finally {
    globalThis.fetch = originalFetch
    console.warn = originalWarning
  }
})
