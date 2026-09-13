import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FakeIssue } from './fake-driver/fake-github'
import { github, OCTOCAT, signIn } from './harness'
import { readTicketPage } from './issues'
import { checkRepository, isRepositoryScope } from './repository'

test('a repository check names the repository by its canonical name', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  fake.addRepository({ fullName: 'Octo/Hello', visibleTo: [OCTOCAT.id], issues: [] })
  fake.addRepository({
    fullName: 'octo/quiet',
    visibleTo: [OCTOCAT.id],
    issues: [],
    hasIssues: false,
  })
  fake.addRepository({ fullName: 'octo/secret', visibleTo: [], issues: [] })
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
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  fake.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues: [] })
  const token = await signIn(endpoints)
  fake.outage('rate-limited')
  assert.deepEqual(await readTicketPage(endpoints, token, { scope: 'octo/hello', ...FIRST }), {
    ok: false,
    failure: 'rate-limited',
  })
  fake.outage('none')
  fake.revoke('octocat')
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

const BACKLOG: FakeIssue[] = [
  { number: 1, title: 'Parent', body: '  The whole thing.  ', children: [2, 3], type: 'PRD' },
  { number: 2, title: 'Open child', blockedBy: [3], labels: [{ name: 'prd', color: 'aa00ff' }] },
  { number: 3, title: 'Closed child', state: 'closed' },
  { number: 4, title: 'A pull request', pullRequest: true },
]

test('open Tickets carry their body, hierarchy and dependencies, and a pull request is none of them', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  fake.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues: BACKLOG })
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
          url: `${fake.origin}/octo/hello/issues/1`,
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
          url: `${fake.origin}/octo/hello/issues/2`,
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
  assert.ok(!fake.requests.some((line) => line.includes('/issues/2/sub_issues')))
})

test('a repository that serves no dependency facts reads as unknown, not unblocked', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  fake.addRepository({
    fullName: 'octo/hello',
    visibleTo: [OCTOCAT.id],
    issues: [{ number: 1, title: 'Alone' }],
    servesDependencies: false,
  })
  const read = await readTicketPage(endpoints, await signIn(endpoints), {
    scope: 'octo/hello',
    ...FIRST,
  })
  assert.ok(read.ok)
  assert.equal(read.value.tickets[0]?.blockedBy, null)
})
