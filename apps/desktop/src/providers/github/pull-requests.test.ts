import assert from 'node:assert/strict'
import { test } from 'node:test'
import { github, githubWithRepository, octocatUser, signIn } from '@/providers/github/harness'
import { githubPullRequests } from '@/providers/github/pull-requests'

test('names the repository of each GitHub remote form, and no other host', () => {
  const named = (url: string) => githubPullRequests.repositoryOfRemote(url)
  assert.equal(named('https://github.com/octo/hello.git'), 'octo/hello')
  assert.equal(named('https://token@github.com/octo/hello'), 'octo/hello')
  assert.equal(named('git@github.com:octo/hello.git'), 'octo/hello')
  assert.equal(named('ssh://git@github.com/octo/hello.git'), 'octo/hello')
  assert.equal(named('https://gitlab.com/octo/hello.git'), null)
  assert.equal(named('https://github.com.evil.test/octo/hello.git'), null)
  assert.equal(named('/local/path/hello.git'), null)
})

test('lists the open pull requests with their head branch, and no issue', async (context) => {
  const { endpoints, token } = await githubWithRepository(context, {
    fullName: 'octo/hello',
    issues: [
      { number: 1, title: 'An issue' },
      { number: 2, title: 'Add a greeting', pullRequest: true, branch: 'greeting' },
      { number: 3, title: 'Closed change', pullRequest: true, state: 'closed' },
    ],
  })
  assert.deepEqual(
    await githubPullRequests.listOpen(
      { endpoints: { github: endpoints, linear: null }, token },
      'octo/hello',
    ),
    { ok: true, value: [{ number: 2, title: 'Add a greeting', branch: 'greeting' }] },
  )
})

test('a hidden repository, a revoked token and an outage are told apart', async (context) => {
  const [mock, endpoints] = await github(context)
  mock.signIn(octocatUser())
  mock.addRepository({ fullName: 'octo/secret', visibleTo: [], issues: [] })
  mock.addRepository({ fullName: 'octo/hello', visibleTo: [octocatUser().id], issues: [] })
  const token = await signIn(endpoints)
  const reader = { endpoints: { github: endpoints, linear: null }, token }
  assert.deepEqual(await githubPullRequests.listOpen(reader, 'octo/secret'), {
    ok: false,
    failure: 'not-visible',
  })
  mock.outage('down')
  assert.deepEqual(await githubPullRequests.listOpen(reader, 'octo/hello'), {
    ok: false,
    failure: 'unreachable',
  })
  mock.outage('none')
  mock.revoke('octocat')
  assert.deepEqual(await githubPullRequests.listOpen(reader, 'octo/hello'), {
    ok: false,
    failure: 'refused',
  })
})
