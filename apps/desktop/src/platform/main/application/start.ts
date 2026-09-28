import { app } from 'electron'
import { createActor } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import type { SessionEventJournal } from '@/domains/sessions/main/live/session-event-journal'
import type { SessionInteractionBroker } from '@/domains/sessions/main/live/session-interaction-broker'
import type { TicketSyncDependencies } from '@/domains/tickets/main/sync/ticket-sync-machine'
import type { Harness } from '@/harnesses/harness'
import type { HarnessRegistry } from '@/harnesses/registry'
import { applyStoredAppearance, readAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'
import { type AppActor, createAppMachine } from './app-machine'

export function startDesktopApplication(request: {
  prepare: () => Promise<{
    database: Database
    sessionSyncStatus: Record<Harness, SessionSyncStatusStore>
    sessionEventJournal?: SessionEventJournal
    sessionInteractionBroker?: SessionInteractionBroker
    ticketSync: TicketSyncDependencies
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
    applyStoredAppearance(await readAppearance(app.getPath('userData')))
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
