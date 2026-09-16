// The packaged Ticket proof (#1848, #1849, #2013): connect an Account, connect a source, list,
// detail, a status change, restart, revoked access, an expired renewal, disconnect and a visible
// failure, all through the shipped cockpit against a fake GitHub and a fake Linear.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication } from 'playwright-core'
import {
  type CaseResults,
  createCaseRunner,
  printPackagedProofResult,
} from '../../desktop-proof/packaged-case-runner'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import {
  proveLinearBacklog,
  proveLinearConnect,
  proveLinearDisconnect,
  proveLinearExpired,
  proveLinearRestart,
  proveLinearStatus,
} from './linear-proof-cases'
import { proveBacklog, proveConnect, proveConnectRepository } from './ticket-proof-cases'
import { launch, prepare, type TicketFixture } from './ticket-proof-fixture'
import {
  proveChangeState,
  proveDisconnect,
  proveRestartAndFailure,
  proveRevoked,
} from './ticket-proof-lifecycle-cases'
import type { Run } from './ticket-proof-screen'

async function start(fixture: TicketFixture): Promise<Run> {
  const application = await launch(fixture)
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  await page.waitForFunction(() => typeof window.argo?.listTickets === 'function')
  return { application, page, fixture }
}

const root = await mkdtemp(path.join(os.tmpdir(), 'argo-packaged-tickets-'))
let application: ElectronApplication | undefined
let fixture: TicketFixture | undefined
const results: CaseResults = { cases: [], timings: {} }
const ran = createCaseRunner(results)
try {
  fixture = await prepare(root)
  let run = await start(fixture)
  application = run.application
  await proveConnect(run, ran)
  await proveConnectRepository(run, ran)
  await proveBacklog(run, ran)
  await run.application.close()
  fixture.github.outage('down')
  run = await start(fixture)
  application = run.application
  await proveRestartAndFailure(run, ran)
  await proveRevoked(run, ran)
  await proveChangeState(run, ran)
  await proveDisconnect(run, ran)
  await proveLinearConnect(run, ran)
  await proveLinearBacklog(run, ran)
  await proveLinearStatus(run, ran)
  await run.application.close()
  run = await start(fixture)
  application = run.application
  await proveLinearRestart(run, ran)
  await proveLinearExpired(run, ran)
  await proveLinearDisconnect(run, ran)
  await assertShippedFusesIntact()
  printPackagedProofResult(results.cases)
} finally {
  try {
    if (application) await application.close()
  } finally {
    await fixture?.github.close()
    await fixture?.linear.close()
    await rm(root, { recursive: true, force: true })
  }
}
