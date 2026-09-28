import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { onTestFinished, test } from 'vitest'
import { openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { isAccountChallengeReply, type Provider } from '@/domains/accounts/contract/contract'
import { createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { createSignIn } from '@/domains/accounts/main/sign-in'
import { createConnectionPort } from '@/domains/connections/main'
import { createTicketRouter } from '@/domains/tickets/main/ticket-router'
import { proofEndpoints } from '@/providers/github/endpoints'
import { OCTOCAT } from '@/providers/github/harness'
import { linearProofEndpoints } from '@/providers/linear/endpoints'
import { ADA, browse, TEAM } from '@/providers/linear/harness'
import { PROVIDER_REGISTRY } from '@/providers/registry'
import { startMockGitHub } from '../../mocks/providers/github/mock-github'
import { startMockLinear } from '../../mocks/providers/linear/mock-linear'

const cipher: Cipher = {
  available: () => true,
  encrypt: (text) => Buffer.from(text),
  decrypt: (data) => data.toString(),
}

const projectId = 'project-one'

// Both providers behind the one registry, each answering from its mock, and one registered Project.
async function flows() {
  const gitHub = await startMockGitHub()
  onTestFinished(() => gitHub.close())
  const mockLinear = await startMockLinear()
  onTestFinished(() => mockLinear.close())
  const githubEndpoints = proofEndpoints(gitHub.origin)
  const linearEndpoints = linearProofEndpoints(mockLinear.origin)
  assert.ok(githubEndpoints && linearEndpoints)
  gitHub.signIn(OCTOCAT)
  mockLinear.signIn(ADA)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-provider-registry-'))
  onTestFinished(() => rm(directory, { force: true, recursive: true }))
  const database = openDatabase(directory)
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({ id: projectId, path: '/repo', commonDirectory: '/repo/.git' })
    .run()
  const opened: string[] = []
  const access = createAccountAccess({
    userData: directory,
    accountData: directory,
    endpoints: { github: githubEndpoints, linear: linearEndpoints },
    providers: PROVIDER_REGISTRY,
    cipher,
    openExternal: async (url) => {
      opened.push(url)
    },
    database,
  })
  const signIn = createSignIn(access)
  onTestFinished(() => signIn.dispose())
  const tickets = createTicketRouter({
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    providers: PROVIDER_REGISTRY,
  }).createCaller({})
  return { gitHub, mockLinear, signIn, opened, tickets }
}

async function challenged(provider: Provider) {
  const flow = await flows()
  const challenge = await flow.signIn.connect('request-1', provider)
  assert.ok(isAccountChallengeReply(challenge))
  assert.equal(challenge.type, 'account.challenge')
  return { ...flow, challenge }
}

async function signedInToGitHub() {
  const flow = await challenged('github')
  const connected = await flow.signIn.wait('request-2')
  assert.ok(connected.type === 'account.connected')
  return { ...flow, accountId: connected.accountId }
}

async function signedInToLinear() {
  const flow = await challenged('linear')
  const waited = flow.signIn.wait('request-2')
  await flow.signIn.verify('request-3')
  const [page] = flow.opened
  assert.ok(page)
  await browse(page)
  const connected = await waited
  assert.ok(connected.type === 'account.connected')
  return { ...flow, accountId: connected.accountId }
}

// Connects the Project to the scope and answers the keys of the Tickets the list then shows.
async function connectedKeys(
  tickets: Awaited<ReturnType<typeof flows>>['tickets'],
  accountId: string,
  scope: string,
) {
  const connected = await tickets.connect({ projectId, accountId, scope })
  assert.equal(connected.type, 'ticket.connected')
  const listed = await tickets.list({ projectId, query: '', cursor: null })
  assert.ok(listed.type === 'ticket.listed')
  return listed.tickets.map((ticket) => ticket.key).sort()
}

test('a GitHub sign-in asks for a device code and connects the Account it grants', async () => {
  const { challenge, accountId } = await signedInToGitHub()
  assert.ok(challenge.type === 'account.challenge' && challenge.kind === 'device-code')
  assert.equal(challenge.provider, 'github')
  assert.ok(challenge.userCode.length > 0)
  assert.equal(accountId, `github:${OCTOCAT.id}`)
})

test('a Linear sign-in asks for browser consent and connects the Account it grants', async () => {
  const { challenge, accountId } = await signedInToLinear()
  assert.ok(challenge.type === 'account.challenge' && challenge.kind === 'browser-consent')
  assert.equal(challenge.provider, 'linear')
  assert.equal('userCode' in challenge, false)
  assert.equal(accountId, `linear:${ADA.id}`)
})

test('the shared Ticket flows read and close a GitHub issue through the registry', async () => {
  const { gitHub, tickets, accountId } = await signedInToGitHub()
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [OCTOCAT.id],
    issues: [{ number: 1, title: 'Wire the registry' }],
  })
  assert.deepEqual(await connectedKeys(tickets, accountId, 'octo/hello'), ['#1'])
  const updated = await tickets.updateStatus({ projectId, key: '#1', statusId: 'completed' })
  assert.ok(updated.type === 'ticket.updated')
  assert.equal(updated.status.id, 'completed')
})

test('the shared Ticket flows read and reprioritize a Linear issue through the registry', async () => {
  const { mockLinear, tickets, accountId } = await signedInToLinear()
  mockLinear.addTeam(TEAM)
  assert.deepEqual(await connectedKeys(tickets, accountId, TEAM.id), ['ENG-1', 'ENG-2'])
  const prioritized = await tickets.updatePriority({ projectId, key: 'ENG-1', priorityLevel: 1 })
  assert.ok(prioritized.type === 'ticket.prioritized')
  assert.equal(prioritized.priority?.level, 1)
})
