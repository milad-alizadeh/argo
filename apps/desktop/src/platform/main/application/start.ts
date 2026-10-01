import { app } from 'electron'
import { createActor } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionListChanges } from '@/domains/sessions/main/api'
import type { SessionEventJournal, SessionInteractionBroker } from '@/domains/sessions/main/live'
import type { TicketOperationSupervisorInput } from '@/domains/tickets/main/operations'
import type { TicketSyncSupervisorInput } from '@/domains/tickets/main/sync'
import type { HarnessRegistry } from '@/harnesses/registry'
import { initializeAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'
import { type AppActor, createAppMachine } from './app-machine'

export function startDesktopApplication(request: {
  prepare: () => Promise<{
    database: Database
    sessionListChanges: SessionListChanges
    sessionEventJournal?: SessionEventJournal
    sessionInteractionBroker?: SessionInteractionBroker
    ticketSync: TicketSyncSupervisorInput
    ticketOperations: TicketOperationSupervisorInput
    registry: HarnessRegistry
  }>
  ready: (actor: AppActor) => Promise<void> | void
  willQuit: () => void
  focusExistingWindow: () => void
}): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  let actor: AppActor | undefined
  app.on('second-instance', request.focusExistingWindow)
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => {
    actor?.send({ type: 'Shutdown' })
    request.willQuit()
  })

  async function initialize(): Promise<void> {
    await app.whenReady()
    setPlatformLanguage(app.getLocale())
    await initializeAppearance(app.getPath('userData'))
    const input = await request.prepare()
    const { registry, ...applicationInput } = input
    actor = createActor(createAppMachine(registry, applicationInput), {
      input: applicationInput,
    }).start()
    await request.ready(actor)
  }

  void initialize().catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
}
