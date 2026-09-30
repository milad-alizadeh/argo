import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { onTestFinished, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import { isAccountChallengeReply, type Provider } from '@/domains/accounts/contract/contract'
import { type AccountAccess, createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { createSignIn } from '@/domains/accounts/main/sign-in'
import { createConnectionPort } from '@/domains/connections/main'
import { ticketProcedures } from '@/domains/tickets/main/api'
import {
  changeTicketPriority,
  changeTicketStatus,
  ticketOperationSupervisorMachine,
  ticketWriter,
} from '@/domains/tickets/main/operations'
import {
  TICKET_SYNC_TIMING,
  TicketChanges,
  ticketByIdReader,
  ticketPageReader,
  ticketSyncSupervisorMachine,
} from '@/domains/tickets/main/sync'
import { proofEndpoints } from '@/providers/github/endpoints'
import { octocatUser } from '@/providers/github/harness'
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
      readTicket: ticketByIdReader({ access, providers: PROVIDER_REGISTRY }),
      changed: changes.changed,
      timing: TICKET_SYNC_TIMING,
    },
  }).start()
  const ticketOperations = createActor(ticketOperationSupervisorMachine, {
    input: {
      database,
      write: ticketWriter({ access, providers: PROVIDER_REGISTRY }),
      changed: changes.changed,
    },
  }).start()
  onTestFinished(() => {
    ticketSync.stop()
    ticketOperations.stop()
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
      changeStatus: (request) => changeTicketStatus(ticketOperations, request),
      changePriority: (request) => changeTicketPriority(ticketOperations, request),
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
  gitHub.signIn(octocatUser())
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
  flow: Awaited<ReturnType<typeof flows>>,
  accountId: string,
  scope: string,
) {
  const connected = await flow.tickets.ticketConnect({ projectId, accountId, scope })
  assert.equal(connected.type, 'ticket.connected')
  const listed = await synced(flow)
  assert.ok(listed.type === 'ticket.indexed')
  return listed.tickets.map((ticket) => ticket.key).sort()
}

test('a GitHub sign-in asks for a device code and connects the Account it grants', async () => {
  const { challenge, accountId } = await signedInToGitHub()
  assert.ok(challenge.type === 'account.challenge' && challenge.kind === 'device-code')
  assert.equal(challenge.provider, 'github')
  assert.ok(challenge.userCode.length > 0)
  assert.equal(accountId, `github:${octocatUser().id}`)
})

test('a Linear sign-in asks for browser consent and connects the Account it grants', async () => {
  const { challenge, accountId } = await signedInToLinear()
  assert.ok(challenge.type === 'account.challenge' && challenge.kind === 'browser-consent')
  assert.equal(challenge.provider, 'linear')
  assert.equal('userCode' in challenge, false)
  assert.equal(accountId, `linear:${ADA.id}`)
})

test('the shared Ticket flows read and close a GitHub issue through the registry', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId } = flow
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    issues: [{ number: 1, title: 'Wire the registry' }],
  })
  assert.deepEqual(await connectedKeys(flow, accountId, 'octo/hello'), ['#1'])
  const updated = await tickets.ticketUpdateStatus({ projectId, key: '#1', statusId: 'completed' })
  assert.ok(updated.type === 'ticket.updated')
  assert.equal(updated.status.id, 'completed')
})

function intents(database: Database) {
  return database
    .select({ phase: ticketWriteIntent.phase, failure: ticketWriteIntent.failure })
    .from(ticketWriteIntent)
    .all()
}

test('a confirmed GitHub status change is recorded, committed, then announced', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId, changes, database } = flow
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    issues: [{ number: 1, title: 'Wire the registry' }],
  })
  await connectedKeys(flow, accountId, 'octo/hello')
  const seen: string[] = []
  changes.subscribe(() => {
    // The saved Ticket already holds the confirmed status when the change is announced.
    const saved = database.select({ status: ticketContent.statusJson }).from(ticketContent).all()
    seen.push(JSON.parse(saved[0]?.status ?? 'null').id)
  })
  const updated = await tickets.ticketUpdateStatus({ projectId, key: '#1', statusId: 'completed' })
  assert.ok(updated.type === 'ticket.updated')
  assert.deepEqual(seen, ['completed'])
  assert.deepEqual(intents(database), [{ phase: 'committed', failure: null }])
})

test('a GitHub status change the provider refuses leaves the saved Ticket unchanged', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId, changes, database } = flow
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    writers: [],
    issues: [{ number: 1, title: 'Wire the registry' }],
  })
  await connectedKeys(flow, accountId, 'octo/hello')
  let announced = 0
  changes.subscribe(() => {
    announced += 1
  })
  const refused = await tickets.ticketUpdateStatus({ projectId, key: '#1', statusId: 'completed' })
  assert.ok(refused.type === 'ticket.error')
  assert.equal(refused.code, 'ticket-not-writable')
  const saved = await tickets.ticketDetail({ projectId, reference: '#1' })
  assert.ok(saved.type === 'ticket.detail')
  assert.equal(saved.ticket?.status.id, 'open')
  assert.equal(announced, 0)
  assert.deepEqual(intents(database), [{ phase: 'rejected', failure: 'ticket-not-writable' }])
})

test('a Linear status change the provider refuses leaves the saved Ticket unchanged', async () => {
  const flow = await signedInToLinear()
  const { mockLinear, tickets, accountId, database } = flow
  mockLinear.addTeam(TEAM)
  await connectedKeys(flow, accountId, TEAM.id)
  const before = await tickets.ticketDetail({ projectId, reference: 'ENG-2' })
  assert.ok(before.type === 'ticket.detail')
  mockLinear.refuseWrites()
  const refused = await tickets.ticketUpdateStatus({
    projectId,
    key: 'ENG-2',
    statusId: 'team-engine-done',
  })
  assert.ok(refused.type === 'ticket.error')
  assert.equal(refused.code, 'ticket-not-writable')
  const after = await tickets.ticketDetail({ projectId, reference: 'ENG-2' })
  assert.ok(after.type === 'ticket.detail')
  assert.deepEqual(after.ticket?.status, before.ticket?.status)
  assert.deepEqual(intents(database), [{ phase: 'rejected', failure: 'ticket-not-writable' }])
})

test('a confirmed Linear priority is committed to SQLite and announced', async () => {
  const flow = await signedInToLinear()
  const { mockLinear, tickets, accountId, changes, database } = flow
  mockLinear.addTeam(TEAM)
  await connectedKeys(flow, accountId, TEAM.id)
  let announced = 0
  changes.subscribe(() => {
    announced += 1
  })
  const prioritized = await tickets.ticketUpdatePriority({
    projectId,
    key: 'ENG-1',
    priorityLevel: 1,
  })
  assert.ok(prioritized.type === 'ticket.prioritized')
  assert.equal(prioritized.priority?.level, 1)
  const saved = await tickets.ticketDetail({ projectId, reference: 'ENG-1' })
  assert.ok(saved.type === 'ticket.detail')
  assert.equal(saved.ticket?.priority?.level, 1)
  assert.equal(announced, 1)
  assert.deepEqual(intents(database), [{ phase: 'committed', failure: null }])
})

test('a Linear priority change the provider refuses keeps the committed value', async () => {
  const flow = await signedInToLinear()
  const { mockLinear, tickets, accountId, database } = flow
  mockLinear.addTeam(TEAM)
  await connectedKeys(flow, accountId, TEAM.id)
  mockLinear.refuseWrites()
  const refused = await tickets.ticketUpdatePriority({
    projectId,
    key: 'ENG-1',
    priorityLevel: 1,
  })
  assert.ok(refused.type === 'ticket.error')
  assert.equal(refused.code, 'ticket-not-writable')
  const saved = await tickets.ticketDetail({ projectId, reference: 'ENG-1' })
  assert.ok(saved.type === 'ticket.detail')
  assert.equal(saved.ticket?.priority?.level, 2)
  assert.deepEqual(intents(database), [{ phase: 'rejected', failure: 'ticket-not-writable' }])
})

test('a GitHub Ticket refuses a priority change and keeps the refusal as a rejected intent', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId, database } = flow
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    writers: [octocatUser().id],
    issues: [{ number: 1, title: 'Wire the registry' }],
  })
  await connectedKeys(flow, accountId, 'octo/hello')
  const refused = await tickets.ticketUpdatePriority({ projectId, key: '#1', priorityLevel: 1 })
  assert.ok(refused.type === 'ticket.error')
  assert.equal(refused.code, 'ticket-not-writable')
  assert.deepEqual(intents(database), [{ phase: 'rejected', failure: 'ticket-not-writable' }])
})

test('the priority levels come from Linear, and GitHub offers none', async () => {
  const linear = await signedInToLinear()
  linear.mockLinear.addTeam(TEAM)
  await connectedKeys(linear, linear.accountId, TEAM.id)
  const offered = await linear.tickets.ticketPriorityChoices({ projectId })
  assert.ok(offered.type === 'ticket.priorityChoices')
  assert.deepEqual(
    offered.choices.map(({ level, label }) => [level, label]),
    [
      [1, 'Urgent'],
      [2, 'High'],
      [3, 'Medium'],
      [4, 'Low'],
    ],
  )
  const github = await signedInToGitHub()
  github.gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    writers: [octocatUser().id],
    issues: [],
  })
  await connectedKeys(github, github.accountId, 'octo/hello')
  const none = await github.tickets.ticketPriorityChoices({ projectId })
  assert.ok(none.type === 'ticket.priorityChoices')
  assert.deepEqual(none.choices, [])
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
  gitHub.addRepository({ fullName: 'octo/hello', visibleTo: [octocatUser().id], issues })
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
    visibleTo: [octocatUser().id],
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

// Answers the saved Ticket after the provider read, and whether it was saved before the reply.
async function opened({ tickets, changes }: Flow, reference: string) {
  let savedBeforeReply = false
  const stop = changes.subscribe(() => {
    savedBeforeReply = true
  })
  try {
    const reply = await tickets.ticketOpen({ projectId, reference })
    const detail = await tickets.ticketDetail({ projectId, reference })
    assert.ok(detail.type === 'ticket.detail')
    return { reply, detail, savedBeforeReply }
  } finally {
    stop()
  }
}

test('a GitHub Ticket outside the active list opens by ID and stays readable from SQLite', async () => {
  const flow = await signedInToGitHub()
  const { gitHub, tickets, accountId } = flow
  const issues = [
    { number: 1, title: 'Wire the registry' },
    { number: 3, title: 'Shipped already', state: 'closed' as const },
  ]
  gitHub.addRepository({ fullName: 'octo/hello', visibleTo: [octocatUser().id], issues })
  await tickets.ticketConnect({ projectId, accountId, scope: 'octo/hello' })
  await synced(flow)
  const unread = await tickets.ticketDetail({ projectId, reference: '#3' })
  assert.ok(unread.type === 'ticket.detail')
  assert.equal(unread.ticket, null)

  const closed = await opened(flow, '#3')
  assert.ok(closed.reply.type === 'ticket.opened')
  assert.equal(closed.savedBeforeReply, true)
  assert.equal(closed.detail.ticket?.title, 'Shipped already')
  assert.equal(closed.detail.ticket?.state, 'closed')
  assert.equal(closed.detail.argoId, closed.reply.argoId)
  // The Ticket read by ID does not join the active list.
  const active = await synced(flow)
  assert.deepEqual(
    active.tickets.map(({ key }) => key),
    ['#1'],
  )

  const missing = await opened(flow, '#99')
  assert.ok(missing.reply.type === 'ticket.error')
  assert.equal(missing.reply.code, 'ticket-not-found')
  // A repository out of sight also answers 404, and is named as that, not as a missing Ticket.
  gitHub.addRepository({ fullName: 'octo/hello', visibleTo: [], issues })
  const hidden = await opened(flow, '#3')
  assert.ok(hidden.reply.type === 'ticket.error')
  assert.equal(hidden.reply.code, 'repository-not-visible')

  // #1 leaves the active list; its saved row still answers by key and by Argo UUID, GitHub down.
  gitHub.addRepository({
    fullName: 'octo/hello',
    visibleTo: [octocatUser().id],
    issues: [{ number: 1, title: 'Wire the registry', state: 'closed' as const }],
  })
  assert.deepEqual((await synced(flow)).tickets, [])
  gitHub.outage('down')
  const argoId = argoIds(flow)['#1']
  assert.ok(argoId)
  for (const reference of ['#1', argoId]) {
    const saved = await tickets.ticketDetail({ projectId, reference })
    assert.ok(saved.type === 'ticket.detail')
    assert.equal(saved.ticket?.title, 'Wire the registry')
  }
  const refused = await opened(flow, argoId)
  assert.ok(refused.reply.type === 'ticket.error')
  assert.equal(refused.reply.code, 'github-unreachable')
  assert.equal(refused.detail.ticket?.key, '#1')
  assert.equal(refused.savedBeforeReply, false)
})

test('a Linear Ticket outside the active list opens by key or Argo UUID', async () => {
  const flow = await signedInToLinear()
  const { mockLinear, tickets, accountId } = flow
  mockLinear.addTeam(TEAM)
  await tickets.ticketConnect({ projectId, accountId, scope: TEAM.id })
  await synced(flow)

  const done = await opened(flow, 'ENG-3')
  assert.ok(done.reply.type === 'ticket.opened')
  assert.equal(done.savedBeforeReply, true)
  assert.equal(done.detail.ticket?.title, 'Cast the gears')
  assert.equal(done.detail.ticket?.status.name, 'Done')
  // Linear's issue id is the native ID, so a later scan or read keeps the Argo UUID.
  assert.equal(argoIds(flow)['issue-ENG-3'], done.reply.argoId)
  const byArgoId = await opened(flow, done.reply.argoId)
  assert.ok(byArgoId.reply.type === 'ticket.opened')
  assert.equal(byArgoId.reply.argoId, done.reply.argoId)
  assert.equal(byArgoId.detail.ticket?.key, 'ENG-3')

  const byNativeId = await opened(flow, 'issue-ENG-3')
  assert.ok(byNativeId.reply.type === 'ticket.opened')
  assert.equal(byNativeId.reply.argoId, done.reply.argoId)

  // ENG-2 moves to Done and leaves the active list; its saved row still answers.
  const moved = await tickets.ticketUpdateStatus({
    projectId,
    key: 'ENG-2',
    statusId: 'team-engine-done',
  })
  assert.equal(moved.type, 'ticket.updated')
  assert.deepEqual(
    (await synced(flow)).tickets.map(({ key }) => key),
    ['ENG-1'],
  )
  const retained = await tickets.ticketDetail({ projectId, reference: 'ENG-2' })
  assert.ok(retained.type === 'ticket.detail')
  assert.equal(retained.ticket?.status.name, 'Done')

  const missing = await opened(flow, 'ENG-404')
  assert.ok(missing.reply.type === 'ticket.error')
  assert.equal(missing.reply.code, 'ticket-not-found')
  assert.equal(missing.detail.ticket, null)
})
