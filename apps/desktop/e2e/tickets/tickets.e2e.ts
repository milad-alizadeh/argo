// The packaged Ticket proof (#1848, #1849, #2013): connect an Account, connect a source, list,
// detail, a status change, restart, revoked access, an expired renewal, disconnect and a visible
// failure, all through the shipped cockpit against a mock GitHub and a mock Linear. Each case
// declares the Accounts and source it starts with (`ticket-test.ts`).
import { assertShippedFusesIntact } from '../packaged-app'
import { proveBacklog, proveConnect, proveConnectRepository } from './cases/github.case'
import {
  proveChangeState,
  proveDisconnect,
  proveRestartAndFailure,
  proveRevoked,
} from './cases/lifecycle.case'
import {
  proveLinearBacklog,
  proveLinearConnect,
  proveLinearDisconnect,
  proveLinearExpired,
  proveLinearRestart,
  proveLinearStatus,
} from './cases/linear.case'
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
  test('restart while GitHub is down', async ({ tickets }) => {
    tickets.run().fixture.github.outage('down')
    await proveRestartAndFailure(await tickets.restart())
  })
  test('revoked access', ({ tickets }) => proveRevoked(tickets.run()))
  test('a Ticket changes state', ({ tickets }) => proveChangeState(tickets.run()))
  test('disconnect the GitHub Account', ({ tickets }) => proveDisconnect(tickets.run()))
})

test.describe('with a Linear team', () => {
  test.use({ ticketState: 'linear-team' })

  test('list the Linear backlog', ({ tickets }) => proveLinearBacklog(tickets.run()))
  test('change a Linear status', ({ tickets }) => proveLinearStatus(tickets.run()))
  test('restart with a Linear Account', async ({ tickets }) => {
    await proveLinearStatus(tickets.run())
    await proveLinearRestart(await tickets.restart())
  })
  test('an expired Linear renewal', ({ tickets }) => proveLinearExpired(tickets.run()))
  test('disconnect the Linear Account', ({ tickets }) => proveLinearDisconnect(tickets.run()))
})

test('the shipped app keeps its fuses', () => assertShippedFusesIntact())
