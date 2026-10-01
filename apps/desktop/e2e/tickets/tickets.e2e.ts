// The packaged Ticket proof (#1848, #1849, #2013, #2870, #2871, #2873, #2874, #2876, #2877): connect an Account, connect a
// source, list, detail, a status change, restart, revoked access, an expired renewal, disconnect, a
// visible failure, the automatic refresh, linked Tickets opened by ID and search beyond the local index, all through the shipped
// cockpit against a mock GitHub and a mock Linear. Each case declares the Accounts and source it
// starts with (`ticket-test.ts`).
import { packagedRun } from '../application-under-test'
import { assertShippedFusesIntact } from '../packaged-app'
import { proveGitHubClosed, proveLinearClosed } from './cases/closed.case'
import {
  proveBacklog,
  proveCommittedBacklog,
  proveConnect,
  proveConnectRepository,
  proveGitHubNoPriority,
  proveGitHubStatus,
  proveGitHubStatusRefused,
  proveGitHubStatusUncertain,
  proveRestartFromSqlite,
  proveRestartReconcilesUncertainStatus,
  proveStaleListKeepsConfirmedStatus,
} from './cases/github.case'
import {
  proveChangeState,
  proveDisconnect,
  proveRestartAndFailure,
  proveRevoked,
} from './cases/lifecycle.case'
import {
  proveLinearBacklog,
  proveLinearCommitted,
  proveLinearConnect,
  proveLinearDisconnect,
  proveLinearExpired,
  proveLinearPriority,
  proveLinearPriorityRefused,
  proveLinearRestart,
  proveLinearStatus,
  proveLinearStatusRefused,
} from './cases/linear.case'
import { proveGitHubLinkedTicket, proveLinearLinkedTicket } from './cases/linked.case'
import { proveLinkedSessionsFollowTicket } from './cases/linked-sessions.case'
import { proveGitHubMissing, proveLinearMissing } from './cases/missing.case'
import { proveAutomaticRefresh } from './cases/refresh.case'
import { proveSearchBeyondIndex, proveSearchFilters } from './cases/search.case'
import { test } from './ticket-test'

test('connect a GitHub Account', ({ tickets }) => proveConnect(tickets.run()))

test.describe('with GitHub Accounts', () => {
  test.use({ ticketState: 'github-accounts' })

  test('connect a repository', ({ tickets }) => proveConnectRepository(tickets.run()))
  test('connect a Linear Account', ({ tickets }) => proveLinearConnect(tickets.run()))
})

test.describe('with a GitHub repository', () => {
  test.use({ ticketState: 'github-repository' })

  test('list the backlog', ({ tickets }) => proveBacklog(tickets.run()))
  test('change a GitHub status', ({ tickets }) => proveGitHubStatus(tickets.run()))
  test('a refused GitHub status change leaves the Ticket as it was', ({ tickets }) =>
    proveGitHubStatusRefused(tickets.run()))
  test('a GitHub Ticket offers no priority control', ({ tickets }) =>
    proveGitHubNoPriority(tickets.run()))
  test('a stale list read cannot undo a confirmed GitHub status', ({ tickets }) =>
    proveStaleListKeepsConfirmedStatus(tickets.run()))
  test('the backlog reads committed Tickets', ({ tickets }) => proveCommittedBacklog(tickets.run()))
  test('a restart draws committed Tickets while GitHub holds every read', async ({ tickets }) => {
    const release = tickets.run().fixture.github.holdReads()
    await proveRestartFromSqlite(await tickets.restart(), release)
  })
  test('restart while GitHub is down', async ({ tickets }) => {
    tickets.run().fixture.github.outage('down')
    await proveRestartAndFailure(await tickets.restart())
  })
  test('a status change left uncertain by an outage reconciles after restart', async ({
    tickets,
  }) => {
    await proveGitHubStatusUncertain(tickets.run())
    await proveRestartReconcilesUncertainStatus(await tickets.restart())
  })
  test('revoked access', ({ tickets }) => proveRevoked(tickets.run()))
  test('a Ticket changes state', ({ tickets }) => proveChangeState(tickets.run()))
  test('disconnect the GitHub Account', ({ tickets }) => proveDisconnect(tickets.run()))
  test('a linked GitHub Ticket opens by ID', ({ tickets }) =>
    proveGitHubLinkedTicket(tickets.run()))
  test('Closed loads a page at a time from GitHub', ({ tickets }) =>
    proveGitHubClosed(tickets.run()))
  test('search reaches Tickets beyond the local index', ({ tickets }) =>
    proveSearchBeyondIndex(tickets.run()))
  test('search filters the list by title, body and key', ({ tickets }) =>
    proveSearchFilters(tickets.run()))
})

const PROOF_POLL_MS = 500

test.describe('with a GitHub repository polled quickly', () => {
  test.use({ ticketState: 'github-repository', ticketPollMs: PROOF_POLL_MS })

  test('the visible Project refreshes automatically', ({ tickets }) =>
    proveAutomaticRefresh(tickets.run(), PROOF_POLL_MS))
  test('omitted Tickets resolve as moved or deleted', ({ tickets }) =>
    proveGitHubMissing(tickets.run(), PROOF_POLL_MS))

  test.describe('with a linked Claude and Codex Session', () => {
    test.use({ linkedSessions: true })

    test('linked Sessions follow a renamed Ticket', ({ tickets }) =>
      proveLinkedSessionsFollowTicket(tickets.run()))
  })
})

test.describe('with a Linear team', () => {
  test.use({ ticketState: 'linear-team' })

  test('list the Linear backlog', ({ tickets }) => proveLinearBacklog(tickets.run()))
  test('change a Linear status', ({ tickets }) => proveLinearStatus(tickets.run()))
  test('a refused Linear status change leaves the Ticket as it was', ({ tickets }) =>
    proveLinearStatusRefused(tickets.run()))
  test('change a Linear priority', ({ tickets }) => proveLinearPriority(tickets.run()))
  test('a refused Linear priority change leaves the Ticket as it was', ({ tickets }) =>
    proveLinearPriorityRefused(tickets.run()))
  test('restart with a Linear Account', async ({ tickets }) => {
    await proveLinearStatus(tickets.run())
    await proveLinearRestart(await tickets.restart())
  })
  test('the Linear scan commits Tickets that keep their identity', ({ tickets }) =>
    proveLinearCommitted(tickets.run(), tickets.restart))
  test('an expired Linear renewal', ({ tickets }) => proveLinearExpired(tickets.run()))
  test('disconnect the Linear Account', ({ tickets }) => proveLinearDisconnect(tickets.run()))
  test('a linked Linear Ticket opens by ID', ({ tickets }) =>
    proveLinearLinkedTicket(tickets.run()))
  test('Closed loads a page at a time from Linear', ({ tickets }) =>
    proveLinearClosed(tickets.run()))
  test('omitted Linear Tickets resolve as moved or deleted', ({ tickets }) =>
    proveLinearMissing(tickets.run()))
})

test('the shipped app keeps its fuses', () => {
  test.skip(!packagedRun, 'Only the packaged app has fuses.')
  return assertShippedFusesIntact()
})
