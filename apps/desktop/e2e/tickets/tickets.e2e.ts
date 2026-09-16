// The packaged Ticket proof (#1848, #1849, #2013): connect an Account, connect a source, list,
// detail, a status change, restart, revoked access, an expired renewal, disconnect and a visible
// failure, all through the shipped cockpit against a mock GitHub and a mock Linear.
import { test } from '@playwright/test'
import { assertShippedFusesIntact } from '../packaged-app'
import { describePackagedProof, type PackagedProof } from '../packaged-proof'
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
import { launch, prepare, type TicketFixture } from './fixtures/tickets.fixture'
import type { Run } from './screen'

async function start(fixture: TicketFixture, proof: PackagedProof): Promise<Run> {
  const application = await launch(fixture)
  await proof.trace(application)
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.listTickets === 'function')
  return { application, page, fixture }
}

describePackagedProof(test, 'tickets', (proof) => {
  let fixture: TicketFixture
  let run: Run | undefined

  const restart = async () => {
    await run?.application.close()
    run = await start(fixture, proof)
    return run
  }

  proof.setup(async () => {
    fixture = await prepare(proof.root)
    run = await start(fixture, proof)
  })

  proof.teardown(async () => {
    try {
      await run?.application.close()
    } finally {
      await fixture?.github.close()
      await fixture?.linear.close()
    }
  })

  const current = () => {
    if (!run) throw new Error('The packaged app did not launch.')
    return run
  }

  test('connect a GitHub Account', () => proveConnect(current()))
  test('connect a repository', () => proveConnectRepository(current()))
  test('list the backlog', () => proveBacklog(current()))

  test('restart while GitHub is down', async () => {
    await current().application.close()
    fixture.github.outage('down')
    run = await start(fixture, proof)
    await proveRestartAndFailure(run)
  })
  test('revoked access', () => proveRevoked(current()))
  test('a Ticket changes state', () => proveChangeState(current()))
  test('disconnect the GitHub Account', () => proveDisconnect(current()))
  test('connect a Linear Account', () => proveLinearConnect(current()))
  test('list the Linear backlog', () => proveLinearBacklog(current()))
  test('change a Linear status', () => proveLinearStatus(current()))

  test('restart with a Linear Account', async () => proveLinearRestart(await restart()))
  test('an expired Linear renewal', () => proveLinearExpired(current()))
  test('disconnect the Linear Account', () => proveLinearDisconnect(current()))

  test('the shipped app keeps its fuses', () => assertShippedFusesIntact())
})
