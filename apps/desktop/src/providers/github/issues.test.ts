import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ticket } from '@/domains/tickets/api/ticket'
import { github, githubWithRepository, octocatUser, signIn } from '@/providers/github/harness'
import { readTicket, readTicketPage } from '@/providers/github/issues'
import { checkRepository, isRepositoryScope } from '@/providers/github/repository'
import { isRecord } from '@/shared/validation'
import type { MockIssue } from '../../../mocks/providers/github/mock-github'
import {
  interceptLabelReadResponses,
  normalizedLabelColors,
  providerLabelColors,
} from '../../../mocks/providers/mock-ticket-label-read'

test('a repository check names the repository by its canonical name', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(octocatUser())
  mock.addRepository({ fullName: 'Octo/Hello', visibleTo: [octocatUser().id], issues: [] })
  mock.addRepository({
    fullName: 'octo/quiet',
    visibleTo: [octocatUser().id],
    issues: [],
    hasIssues: false,
  })
  mock.addRepository({ fullName: 'octo/secret', visibleTo: [], issues: [] })
  const token = await signIn(endpoints)
  assert.deepEqual(await checkRepository(endpoints, token, 'octo/hello'), {
    ok: true,
    fullName: 'Octo/Hello',
  })
  assert.deepEqual(await checkRepository(endpoints, token, 'octo/quiet'), {
    ok: false,
    failure: 'issues-disabled',
  })
  assert.deepEqual(await checkRepository(endpoints, token, 'octo/secret'), {
    ok: false,
    failure: 'not-found',
  })
})

test('a revoked token and a throttled one are told apart', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(octocatUser())
  mock.addRepository({ fullName: 'octo/hello', visibleTo: [octocatUser().id], issues: [] })
  const token = await signIn(endpoints)
  mock.outage('rate-limited')
  assert.deepEqual(await readTicketPage(endpoints, token, { scope: 'octo/hello', ...FIRST }), {
    ok: false,
    failure: 'rate-limited',
  })
  mock.outage('none')
  mock.revoke('octocat')
  assert.deepEqual(await readTicketPage(endpoints, token, { scope: 'octo/hello', ...FIRST }), {
    ok: false,
    failure: 'unauthorized',
  })
})

test('a repository scope is owner/name and nothing that could leave the path', () => {
  for (const scope of ['octo/hello', 'a/b.c', 'a-b/c_d']) assert.ok(isRepositoryScope(scope), scope)
  for (const scope of [
    'octo',
    'octo/',
    '/hello',
    'octo/hello/issues',
    'octo/..',
    'oc to/x',
    '-a/b',
  ]) {
    assert.equal(isRepositoryScope(scope), false, scope)
  }
})

const FIRST = { query: '', page: 1 }

const BACKLOG: MockIssue[] = [
  { number: 1, title: 'Parent', body: '  The whole thing.  ', children: [2, 3], type: 'PRD' },
  { number: 2, title: 'Open child', blockedBy: [3], labels: [{ name: 'prd', color: 'aa00ff' }] },
  { number: 3, title: 'Closed child', state: 'closed' },
  { number: 4, title: 'A pull request', pullRequest: true },
]

test('open Tickets carry their body, hierarchy and dependencies, and a pull request is none of them', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(octocatUser())
  mock.addRepository({ fullName: 'octo/hello', visibleTo: [octocatUser().id], issues: BACKLOG })
  const read = await readTicketPage(endpoints, await signIn(endpoints), {
    scope: 'octo/hello',
    ...FIRST,
  })
  assert.deepEqual(read, {
    ok: true,
    value: {
      nextPage: null,
      total: null,
      tickets: [
        {
          key: '#1',
          url: `${mock.origin}/octo/hello/issues/1`,
          title: 'Parent',
          body: 'The whole thing.',
          state: 'open',
          status: { id: 'open', name: 'Open', category: 'unstarted' },
          priority: null,
          createdAt: '2026-01-01T00:00:00Z',
          labels: [],
          type: 'PRD',
          children: [
            { key: '#2', title: 'Open child', state: 'open' },
            { key: '#3', title: 'Closed child', state: 'closed' },
          ],
          blockedBy: [],
        },
        {
          key: '#2',
          url: `${mock.origin}/octo/hello/issues/2`,
          title: 'Open child',
          body: null,
          state: 'open',
          status: { id: 'open', name: 'Open', category: 'unstarted' },
          priority: null,
          createdAt: '2026-01-01T00:00:00Z',
          labels: [{ name: 'prd', color: 'aa00ff' }],
          type: null,
          children: [],
          blockedBy: [{ key: '#3', title: 'Closed child', state: 'closed' }],
        },
      ],
    },
  })
  assert.ok(!mock.requests.some((line) => line.includes('/issues/2/sub_issues')))
})

test('a repository that serves no dependency facts reads as unknown, not unblocked', async (context) => {
  const { endpoints, token } = await githubWithRepository(context, {
    fullName: 'octo/hello',
    issues: [{ number: 1, title: 'Alone' }],
    servesDependencies: false,
  })
  const read = await readTicketPage(endpoints, token, {
    scope: 'octo/hello',
    ...FIRST,
  })
  assert.ok(read.ok)
  assert.equal(read.value.tickets[0]?.blockedBy, null)
})

test('a Closed page lists only closed issues', async (context) => {
  const { endpoints, token } = await githubWithRepository(context, {
    fullName: 'octo/hello',
    issues: [
      { number: 1, title: 'Open' },
      { number: 2, title: 'Shipped', state: 'closed', stateReason: 'completed' },
      { number: 3, title: 'A pull request', state: 'closed', pullRequest: true },
    ],
  })
  const read = await readTicketPage(endpoints, token, {
    scope: 'octo/hello',
    query: '',
    page: 1,
    state: 'closed',
  })
  assert.ok(read.ok)
  assert.deepEqual(
    read.value.tickets.map((ticket) => ticket.key),
    ['#2'],
  )
})

test('one issue reads by its key, open or closed, and a pull request is not a Ticket', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(octocatUser())
  mock.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    issues: [
      { number: 1, title: 'Shipped', state: 'closed', stateReason: 'completed', children: [2] },
      { number: 2, title: 'Child' },
      { number: 3, title: 'A pull request', pullRequest: true },
    ],
  })
  const token = await signIn(endpoints)
  const read = await readTicket(endpoints, token, { scope: 'octo/hello', id: '#1' })
  assert.ok(read.ok)
  assert.equal(read.value.state, 'closed')
  assert.equal(read.value.status.id, 'completed')
  assert.deepEqual(read.value.children, [{ key: '#2', title: 'Child', state: 'open' }])
  for (const id of ['#3', '#9', 'ENG-1']) {
    assert.deepEqual(await readTicket(endpoints, token, { scope: 'octo/hello', id }), {
      ok: false,
      failure: id === '#9' ? 'not-found' : 'ticket-not-found',
    })
  }
})

function replaceLabels(body: unknown, rawLabels: unknown) {
  for (const issue of Array.isArray(body) ? body : [body]) {
    assert.ok(isRecord(issue))
    issue.labels = rawLabels
  }
}

test('GitHub label reads normalize colors and report aggregate rejections without private payloads', async (context) => {
  const { endpoints, token } = await githubWithRepository(context, {
    fullName: 'octo/hello',
    issues: [{ number: 1, title: 'Labels', labels: [{ name: 'valid', color: '000000' }] }],
  })
  let rawLabels: unknown = [
    'legacy',
    ...providerLabelColors('rgb(0 0 0)'),
    { name: 8, color: 'ffffff' },
    null,
  ]
  const expected = [{ name: 'legacy', color: null }, ...normalizedLabelColors]
  const { warnings, restore } = interceptLabelReadResponses(
    (address) => address.startsWith(`${endpoints.api}/repos/octo/hello/issues`),
    (body) => replaceLabels(body, rawLabels),
  )
  try {
    const page = await readTicketPage(endpoints, token, { scope: 'octo/hello', ...FIRST })
    assert.ok(page.ok)
    assert.deepEqual(page.value.tickets[0]?.labels, expected)
    assert.ok(ticket.safeParse(page.value.tickets[0]).success)
    const single = await readTicket(endpoints, token, { scope: 'octo/hello', id: '#1' })
    assert.ok(single.ok)
    assert.deepEqual(single.value.labels, expected)
    assert.ok(ticket.safeParse(single.value).success)
    const rejection =
      'GitHub Ticket labels: rejected 2 labels[] record(s), 2 labels[].color value(s).'
    assert.deepEqual(warnings, [rejection, rejection])
    rawLabels = { private: 'invalid collection' }
    const malformed = await readTicketPage(endpoints, token, { scope: 'octo/hello', ...FIRST })
    assert.ok(malformed.ok)
    assert.deepEqual(malformed.value.tickets[0]?.labels, [])
    assert.equal(
      warnings[2],
      'GitHub Ticket labels: rejected 1 labels[] record(s), 0 labels[].color value(s).',
    )
    rawLabels = undefined
    const missing = await readTicket(endpoints, token, { scope: 'octo/hello', id: '#1' })
    assert.ok(missing.ok)
    assert.deepEqual(missing.value.labels, [])
    assert.equal(warnings.length, 3)
  } finally {
    restore()
  }
})
