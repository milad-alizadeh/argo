import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FakeIssue } from './fake-driver/fake-github'
import { github, OCTOCAT, signIn } from './harness'
import { readOpenTickets } from './issues'
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
  assert.deepEqual(await readOpenTickets(endpoints, token, 'octo/hello'), {
    ok: false,
    failure: 'rate-limited',
  })
  fake.outage('none')
  fake.revoke('octocat')
  assert.deepEqual(await readOpenTickets(endpoints, token, 'octo/hello'), {
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
  const read = await readOpenTickets(endpoints, await signIn(endpoints), 'octo/hello')
  assert.deepEqual(read, {
    ok: true,
    value: [
      {
        number: 1,
        title: 'Parent',
        body: 'The whole thing.',
        state: 'open',
        stateReason: null,
        labels: [],
        type: 'PRD',
        children: [
          { number: 2, title: 'Open child', state: 'open' },
          { number: 3, title: 'Closed child', state: 'closed' },
        ],
        blockedBy: [],
      },
      {
        number: 2,
        title: 'Open child',
        body: null,
        state: 'open',
        stateReason: null,
        labels: [{ name: 'prd', color: 'aa00ff' }],
        type: null,
        children: [],
        blockedBy: [{ number: 3, title: 'Closed child', state: 'closed' }],
      },
    ],
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
  const read = await readOpenTickets(endpoints, await signIn(endpoints), 'octo/hello')
  assert.ok(read.ok)
  assert.equal(read.value[0]?.blockedBy, null)
})

test('a backlog longer than one page is read to its end', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT)
  const issues = Array.from({ length: 230 }, (_, index) => ({
    number: index + 1,
    title: `T${index}`,
  }))
  fake.addRepository({ fullName: 'octo/big', visibleTo: [OCTOCAT.id], issues })
  const read = await readOpenTickets(endpoints, await signIn(endpoints), 'octo/big')
  assert.ok(read.ok)
  assert.equal(read.value.length, 230)
  assert.equal(read.value[229]?.number, 230)
})
