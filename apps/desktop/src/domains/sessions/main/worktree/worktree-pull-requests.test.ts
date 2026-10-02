import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { promisify } from 'node:util'
import { createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { writeAccounts } from '@/domains/accounts/main/registry'
import { createConnectionPort } from '@/domains/connections/main'
import { GITHUB_ENDPOINTS } from '@/providers/github/endpoints'
import { githubPullRequests } from '@/providers/github/pull-requests'
import type { PullRequestRead, PullRequestSource } from '@/providers/pull-request-source'
import { listProjectPullRequests } from './worktree-pull-requests'

const run = promisify(execFile)
const cipher: Cipher = {
  available: () => true,
  encrypt: (text) => Buffer.from(text),
  decrypt: (data) => data.toString(),
}

type Account = { id: string; token: string; state?: 'connected' | 'revoked' }

// A Project checkout and a code host that answers `reply`, recording the token each read used.
async function listing(
  testContext: TestContext,
  input: { remote?: string; accounts?: Account[]; reply?: PullRequestRead },
) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-pull-requests-')))
  testContext.after(() => rm(root, { recursive: true, force: true }))
  const repository = path.join(root, 'project')
  await run('git', ['init', '--quiet', repository])
  if (input.remote) await run('git', ['-C', repository, 'remote', 'add', 'origin', input.remote])
  const userData = path.join(root, 'user-data')
  const access = createAccountAccess({
    userData,
    accountData: userData,
    endpoints: { github: GITHUB_ENDPOINTS, linear: null },
    providers: { github: { accounts: {} as never }, linear: { accounts: {} as never } },
    cipher,
    openExternal: async () => undefined,
  })
  const accounts = input.accounts ?? []
  await writeAccounts(access.paths.accounts, {
    accounts: accounts.map((account) => ({
      id: account.id,
      provider: 'github',
      providerAccountId: account.id.split(':')[1] ?? '',
      login: account.id,
      workspace: null,
      scopes: ['repo'],
      state: account.state ?? 'connected',
    })),
    noticeDismissed: false,
    other: {},
  })
  for (const account of accounts)
    await access.grants.save(account.id, {
      accessToken: account.token,
      scopes: ['repo'],
      renewal: null,
    })
  const tokens: string[] = []
  const source: PullRequestSource = {
    repositoryOfRemote: githubPullRequests.repositoryOfRemote,
    listOpen: async ({ token }) => {
      tokens.push(token)
      return input.reply ?? { ok: true, value: [] }
    },
  }
  const connections = createConnectionPort({
    path: access.paths.connections,
    exclusive: access.exclusive,
  })
  const context = {
    access,
    connections,
    providers: { github: { pullRequests: source }, linear: { pullRequests: null } },
  }
  const list = () => listProjectPullRequests(context, { id: 'project-1', checkout: repository })
  return { list, tokens, connections }
}

const pullRequest = { number: 4, title: 'Fix the build', branch: 'fix-build' }

test('a Project without a GitHub remote lists no pull requests, and says so', async (context) => {
  const { list } = await listing(context, { accounts: [{ id: 'github:1', token: 'one' }] })
  assert.deepEqual(await list(), { type: 'unavailable', reason: 'no-remote' })
})

test('a GitHub remote without a connected Account says so', async (context) => {
  const { list } = await listing(context, {
    remote: 'git@github.com:octo/hello.git',
    accounts: [{ id: 'github:1', token: 'one', state: 'revoked' }],
  })
  assert.deepEqual(await list(), { type: 'unavailable', reason: 'no-account' })
})

test("reads as the Account of the Project's Ticket Connection, else the first connected one", async (context) => {
  const { list, tokens, connections } = await listing(context, {
    remote: 'https://github.com/octo/hello.git',
    accounts: [
      { id: 'github:1', token: 'first' },
      { id: 'github:2', token: 'connected' },
    ],
    reply: { ok: true, value: [pullRequest] },
  })
  assert.deepEqual(await list(), { type: 'listed', pullRequests: [pullRequest] })
  await connections.replaceTicket('project-1', {
    projectId: 'project-1',
    port: 'ticket',
    provider: 'github',
    accountId: 'github:2',
    scope: 'octo/hello',
    label: 'octo/hello',
  })
  await list()
  assert.deepEqual(tokens, ['first', 'connected'])
})

test('GitHub out of reach, or a repository the Account cannot see, says why', async (context) => {
  const accounts = [{ id: 'github:1', token: 'one' }]
  const remote = 'git@github.com:octo/hello.git'
  const down = await listing(context, {
    remote,
    accounts,
    reply: { ok: false, failure: 'unreachable' },
  })
  assert.deepEqual(await down.list(), { type: 'unavailable', reason: 'unreachable' })
  const hidden = await listing(context, {
    remote,
    accounts,
    reply: { ok: false, failure: 'not-visible' },
  })
  assert.deepEqual(await hidden.list(), { type: 'unavailable', reason: 'not-visible' })
})
