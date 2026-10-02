// The open pull requests a new worktree can start from: read from the code host a Project's git
// remote points at, as the Account its Ticket Connection uses, else the first connected Account.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { z } from 'zod'
import type { Provider } from '@/domains/accounts/contract/contract'
import { type AccountAccess, asAccount, readAccounts } from '@/domains/accounts/main'
import type { ConnectionPort } from '@/domains/connections/main'
import type { pullRequestsUnavailableSchema } from '@/domains/sessions/api/worktree-request'
import type { PullRequest, PullRequestSource } from '@/providers/pull-request-source'

const run = promisify(execFile)

export type PullRequestProviders = Record<Provider, { pullRequests: PullRequestSource | null }>

export type PullRequestContext = {
  access: AccountAccess
  connections: ConnectionPort
  providers: PullRequestProviders
}

export type PullRequestListing =
  | { type: 'listed'; pullRequests: PullRequest[] }
  | { type: 'unavailable'; reason: z.infer<typeof pullRequestsUnavailableSchema> }

type Remote = { name: string; url: string }
type HostRemote = { remote: string; provider: Provider; repository: string }

// Every remote's raw URL, so an `insteadOf` rewrite still names the host the person set.
async function readRemotes(checkout: string): Promise<Remote[]> {
  const listed = await run('git', [
    '-C',
    checkout,
    'config',
    '--get-regexp',
    '^remote\\..*\\.url$',
  ]).catch(() => ({ stdout: '' }))
  return listed.stdout.split('\n').flatMap((line) => {
    const match = line.match(/^remote\.(.+)\.url (.+)$/)
    return match?.[1] && match[2] && !match[1].startsWith('-')
      ? [{ name: match[1], url: match[2] }]
      : []
  })
}

// The remote a code host serves, `origin` first.
async function codeHostRemote(
  checkout: string,
  providers: PullRequestProviders,
): Promise<HostRemote | null> {
  const remotes = (await readRemotes(checkout)).sort(
    (left, right) => Number(right.name === 'origin') - Number(left.name === 'origin'),
  )
  for (const remote of remotes) {
    for (const [provider, registration] of Object.entries(providers) as [
      Provider,
      PullRequestProviders[Provider],
    ][]) {
      const repository = registration.pullRequests?.repositoryOfRemote(remote.url) ?? null
      if (repository !== null) return { remote: remote.name, provider, repository }
    }
  }
  return null
}

async function accountFor(
  context: PullRequestContext,
  projectId: string,
  provider: Provider,
): Promise<string | null> {
  const connections = await context.connections.read()
  const connected = connections.ok
    ? connections.document.connections.find(
        (connection) => connection.projectId === projectId && connection.provider === provider,
      )
    : undefined
  if (connected !== undefined) return connected.accountId
  const registry = await readAccounts(context.access.paths.accounts)
  if (!registry.ok) return null
  const account = registry.registry.accounts.find(
    (candidate) => candidate.provider === provider && candidate.state === 'connected',
  )
  return account?.id ?? null
}

export async function listProjectPullRequests(
  context: PullRequestContext,
  project: { id: string; checkout: string },
): Promise<PullRequestListing> {
  const host = await codeHostRemote(project.checkout, context.providers)
  const source = host === null ? null : context.providers[host.provider].pullRequests
  if (host === null || source === null) return { type: 'unavailable', reason: 'no-remote' }
  const accountId = await accountFor(context, project.id, host.provider)
  if (accountId === null) return { type: 'unavailable', reason: 'no-account' }
  const outcome = await asAccount(context.access, accountId, {
    call: (token) =>
      source.listOpen({ endpoints: context.access.endpoints, token }, host.repository),
    refused: (reply) => !reply.ok && reply.failure === 'refused',
  })
  if (!outcome.ok)
    return {
      type: 'unavailable',
      reason: outcome.reason === 'renewal-failed' ? 'unreachable' : 'no-account',
    }
  const { reply } = outcome
  if (reply.ok) return { type: 'listed', pullRequests: reply.value }
  return { type: 'unavailable', reason: reply.failure === 'refused' ? 'no-account' : reply.failure }
}

// Fetches a pull request's head from the code host's remote and returns its commit.
export async function fetchPullRequestHead(
  checkout: string,
  providers: PullRequestProviders,
  number: number,
): Promise<string> {
  const host = await codeHostRemote(checkout, providers)
  if (host === null) throw new Error('missing-remote')
  await run(
    'git',
    ['-C', checkout, 'fetch', '--no-tags', '--quiet', host.remote, `refs/pull/${number}/head`],
    {
      timeout: 120_000,
    },
  )
  const { stdout } = await run('git', [
    '-C',
    checkout,
    'rev-parse',
    '--verify',
    'FETCH_HEAD^{commit}',
  ])
  return stdout.trim()
}
