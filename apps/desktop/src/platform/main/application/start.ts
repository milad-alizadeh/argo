import { app } from 'electron'
import { createActor } from 'xstate'
import type { DurableDatabase } from '@/database/durable-database'
import { applyStoredAppearance, readAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'
import { type AppActor, appMachine } from './app-machine'

export function startDesktopApplication(request: {
  prepare: () => Promise<{ database: DurableDatabase }>
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
    actor = createActor(appMachine, { input }).start()
    await request.ready(actor)
  }

  void initialize().catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
}
