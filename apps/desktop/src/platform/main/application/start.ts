import { app } from 'electron'
import { applyStoredAppearance, readAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'
import { type ApplicationActors, startApplicationActors } from './actors'

export function startDesktopApplication(request: {
  ready: (actors: ApplicationActors) => Promise<void> | void
  willQuit: () => void
  focusExistingWindow: () => void
}): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  let actors: ApplicationActors | undefined
  app.on('second-instance', request.focusExistingWindow)
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', () => {
    actors?.stop()
    request.willQuit()
  })

  async function initialize(): Promise<void> {
    await app.whenReady()
    setPlatformLanguage(app.getLocale())
    applyStoredAppearance(await readAppearance(app.getPath('userData')))
    actors = startApplicationActors()
    await request.ready(actors)
  }

  void initialize().catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
}
