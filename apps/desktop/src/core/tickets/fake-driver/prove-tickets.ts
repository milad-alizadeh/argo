// The packaged Ticket proof (#1848, #1849, #2013): connect an Account, connect a source, list,
// detail, a status change, restart, revoked access, an expired renewal, disconnect and a visible
// failure, all through the shipped cockpit against a fake GitHub and a fake Linear.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ElectronApplication } from 'playwright-core'
import { assertShippedFusesIntact } from '../../desktop-proof/packaged-test-copy'
import {
  proveLinearBacklog,
  proveLinearConnect,
  proveLinearDisconnect,
  proveLinearExpired,
  proveLinearRestart,
  proveLinearStatus,
} from './linear-proof-cases'
import {
  proveBacklog,
  proveChangeState,
  proveConnect,
  proveConnectRepository,
  proveDisconnect,
  proveRestartAndFailure,
  proveRevoked,
} from './ticket-proof-cases'
import { launch, prepare, type TicketFixture } from './ticket-proof-fixture'
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
try {
  fixture = await prepare(root)
  let run = await start(fixture)
  application = run.application
  await proveConnect(run)
  await proveConnectRepository(run)
  await proveBacklog(run)
  await run.application.close()
  fixture.github.outage('down')
  run = await start(fixture)
  application = run.application
  await proveRestartAndFailure(run)
  await proveRevoked(run)
  await proveChangeState(run)
  await proveDisconnect(run)
  await proveLinearConnect(run)
  await proveLinearBacklog(run)
  await proveLinearStatus(run)
  await run.application.close()
  run = await start(fixture)
  application = run.application
  await proveLinearRestart(run)
  await proveLinearExpired(run)
  await proveLinearDisconnect(run)
  await assertShippedFusesIntact()
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      signed: false,
      profile: 'test',
      cases: [
        'connect',
        'same-identity',
        'second-identity',
        'sealed-grant',
        'unlisted-repository',
        'discoverSources',
        'connectSource',
        'list',
        'detail',
        'restart',
        'visible-failure',
        'revoked-access',
        'reconnect',
        'change-state',
        'disconnect',
        'disconnectSource',
        'linear-connect',
        'linear-sealed-grant',
        'linear-hidden-team',
        'linear-bind',
        'linear-list',
        'linear-detail',
        'linear-change-status',
        'linear-restart-renewal',
        'linear-refresh-failure',
        'linear-reconnect',
        'linear-disconnect',
      ],
    }),
  )
} finally {
  try {
    if (application) await application.close()
  } finally {
    await fixture?.github.close()
    await fixture?.linear.close()
    await rm(root, { recursive: true, force: true })
  }
}
