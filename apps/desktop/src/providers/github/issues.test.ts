import assert from 'node:assert/strict'
import { test } from 'node:test'
import { github, githubWithRepository, OCTOCAT, signIn } from '@/providers/github/harness'
import { readTicketPage } from '@/providers/github/issues'
import { checkRepository, isRepositoryScope } from '@/providers/github/repository'
import type { MockIssue } from '../../../mocks/providers/github/mock-github'

test('a repository check names the repository by its canonical name', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(OCTOCAT)
  mock.addRepository({ fullName: 'Octo/Hello', visibleTo: [OCTOCAT.id], issues: [] })
  mock.addRepository({
    fullName: 'octo/quiet',
    visibleTo: [OCTOCAT.id],
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
  mock.signIn(OCTOCAT)
  mock.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues: [] })
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
  mock.signIn(OCTOCAT)
  mock.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues: BACKLOG })
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
