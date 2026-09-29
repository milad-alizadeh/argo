import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { onTestFinished, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { isAccountChallengeReply, type Provider } from '@/domains/accounts/contract/contract'
import { type AccountAccess, createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { createSignIn } from '@/domains/accounts/main/sign-in'
import { createConnectionPort } from '@/domains/connections/main'
import { ticketProcedures } from '@/domains/tickets/main/api/ticket-procedures'
import { ticketPageReader } from '@/domains/tickets/main/sync/ticket-page-reader'
import {
  TICKET_SYNC_TIMING,
  ticketSyncSupervisorMachine,
} from '@/domains/tickets/main/sync/ticket-sync-supervisor-machine'
import { TicketChanges } from '@/domains/tickets/main/ticket-changes'
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

// The Ticket procedures over a running scan supervisor, called as the renderer calls them.
function ticketCaller(database: Database, access: AccountAccess, changes: TicketChanges) {
  const ticketSync = createActor(ticketSyncSupervisorMachine, {
    input: {
      database,
      readPage: ticketPageReader({ access, providers: PROVIDER_REGISTRY }),
      changed: changes.changed,
      timing: TICKET_SYNC_TIMING,
    },
  }).start()
  onTestFinished(() => {
    ticketSync.stop()
  })
  const procedures = ticketProcedures({
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    providers: PROVIDER_REGISTRY,
    index: {
      database,
      changes,
      send: (command) => ticketSync.send(command),
    },
  })
  return initTRPC.create().router(procedures).createCaller({})
}

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
  const changes = new TicketChanges()
  const tickets = ticketCaller(database, access, changes)
  return { gitHub, mockLinear, signIn, opened, tickets, changes, database }
}

test('an active Linear scan commits Tickets through the same tables and keeps their identity', async () => {
  const flow = await signedInToLinear()
  const { mockLinear, tickets, accountId } = flow
  mockLinear.addTeam(TEAM)
  const connected = await tickets.ticketConnect({ projectId, accountId, scope: TEAM.id })
  assert.equal(connected.type, 'ticket.connected')

  const first = await synced(flow)
  assert.equal(first.sync.complete, true)
  assert.deepEqual(first.tickets.map(({ key }) => key).sort(), ['ENG-1', 'ENG-2'])
  // Linear's own status word is kept beside the shared category.
  assert.equal(
    first.tickets.every(({ status }) => status.name.length > 0 && status.category.length > 0),
    true,
  )
  const identities = argoIds(flow)
  assert.deepEqual(Object.keys(identities).sort(), ['issue-ENG-1', 'issue-ENG-2'])

  // With Linear asked for nothing, the list answers from the committed rows.
  const asked = mockLinear.requests.length
  const saved = await tickets.ticketActive({ projectId, page: 0 })
  assert.ok(saved.type === 'ticket.indexed')
  assert.deepEqual(saved.tickets.map(({ key }) => key).sort(), ['ENG-1', 'ENG-2'])
  assert.equal(mockLinear.requests.length, asked)

  await synced(flow)
  assert.deepEqual(argoIds(flow), identities)
})

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
  const connected = await tickets.ticketConnect({ projectId, accountId, scope })
  assert.equal(connected.type, 'ticket.connected')
  const listed = await tickets.ticketList({ projectId, query: '', cursor: null })
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
  const updated = await tickets.ticketUpdateStatus({ projectId, key: '#1', statusId: 'completed' })
  assert.ok(updated.type === 'ticket.updated')
  assert.equal(updated.status.id, 'completed')
})

test('the shared Ticket flows read and reprioritize a Linear issue through the registry', async () => {
  const { mockLinear, tickets, accountId } = await signedInToLinear()
  mockLinear.addTeam(TEAM)
  assert.deepEqual(await connectedKeys(tickets, accountId, TEAM.id), ['ENG-1', 'ENG-2'])
  const prioritized = await tickets.ticketUpdatePriority({
    projectId,
    key: 'ENG-1',
    priorityLevel: 1,
  })
  assert.ok(prioritized.type === 'ticket.prioritized')
  assert.equal(prioritized.priority?.level, 1)
})

type Flow = Awaited<ReturnType<typeof flows>>

// Waits for a scan outcome after this request's first change, never an earlier scan's.
async function synced({ tickets, changes }: Flow, forProject = projectId) {
  let announced = 0
  const stop = changes.subscribe(() => {
    announced += 1
  })
  try {
    const requested = await tickets.ticketSync({ projectId: forProject })
    assert.equal(requested.type, 'ticket.sync-requested')
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const read = await tickets.ticketActive({ projectId: forProject, page: 0 })
      assert.ok(read.type === 'ticket.indexed')
      if (announced > 0 && (read.sync.phase === 'ready' || read.sync.phase === 'failed'))
        return read
      await new Promise((settle) => setTimeout(settle, 5))
    }
    throw new Error('The Ticket scan did not finish.')
  } finally {
    stop()
  }
}

const argoIds = ({ database }: Flow) =>
  Object.fromEntries(
    database.$client
      .prepare('SELECT native_id, argo_id FROM ticket ORDER BY native_id')
      .all()
      .map((row) => [String(row.native_id), String(row.argo_id)]),
  )

test('an active GitHub scan commits Tickets that the active list reads back from SQLite', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId, changes } = flow
  const issues = [
    { number: 1, title: 'Wire the registry' },
    { number: 2, title: 'Read from SQLite' },
    { number: 3, title: 'Shipped already', state: 'closed' as const },
  ]
  gitHub.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues })
  const connected = await tickets.ticketConnect({ projectId, accountId, scope: 'octo/hello' })
  assert.equal(connected.type, 'ticket.connected')
  const changed: string[] = []
  onTestFinished(changes.subscribe(({ scope }) => changed.push(scope)))

  const first = await synced(flow)
  assert.deepEqual(first.tickets.map(({ key }) => key).sort(), ['#1', '#2'])
  assert.equal(first.sync.complete, true)
  assert.equal(changed.includes('octo/hello'), true)
  const identities = argoIds(flow)

  // With GitHub down the list still answers, from the rows it committed, without asking GitHub.
  gitHub.outage('down')
  const asked = gitHub.requests.length
  const saved = await tickets.ticketActive({ projectId, page: 0 })
  assert.ok(saved.type === 'ticket.indexed')
  assert.deepEqual(saved.tickets.map(({ key }) => key).sort(), ['#1', '#2'])
  assert.equal(gitHub.requests.length, asked)
  const failed = await synced(flow)
  assert.equal(failed.sync.failure, 'github-unreachable')
  assert.deepEqual(failed.tickets.map(({ key }) => key).sort(), ['#1', '#2'])

  // A Ticket created and one edited on GitHub arrive with the next scan; identities hold.
  gitHub.outage('none')
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [OCTOCAT.id],
    issues: [
      { number: 1, title: 'Wire the registry, renamed' },
      issues[1] as (typeof issues)[number],
      issues[2] as (typeof issues)[number],
      { number: 4, title: 'Created outside Argo' },
    ],
  })
  const next = await synced(flow)
  assert.deepEqual(next.tickets.map(({ key, title }) => [key, title]).sort(), [
    ['#1', 'Wire the registry, renamed'],
    ['#2', 'Read from SQLite'],
    ['#4', 'Created outside Argo'],
  ])
  const later = argoIds(flow)
  assert.equal(later['#1'], identities['#1'])
  assert.equal(later['#2'], identities['#2'])

  // Another Project on the same repository sees the same Tickets, not copies of them.
  flow.database
    .insert(project)
    .values({ id: 'project-two', path: '/other', commonDirectory: '/other/.git' })
    .run()
  await tickets.ticketConnect({ projectId: 'project-two', accountId, scope: 'octo/hello' })
  const other = await synced(flow, 'project-two')
  assert.deepEqual(other.tickets.map(({ key }) => key).sort(), ['#1', '#2', '#4'])
  assert.deepEqual(argoIds(flow), later)
})
