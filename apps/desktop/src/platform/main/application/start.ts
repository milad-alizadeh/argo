import { app } from 'electron'
import { applyStoredAppearance, readAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'

export function startDesktopApplication(request: {
  ready: () => Promise<void> | void
  willQuit: () => void
  focusExistingWindow: () => void
}): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  app.on('second-instance', request.focusExistingWindow)
  void app
    .whenReady()
    .then(async () => {
      setPlatformLanguage(app.getLocale())
      applyStoredAppearance(await readAppearance(app.getPath('userData')))
      await request.ready()
    })
    .catch((error: unknown) => {
      console.error(error)
      app.exit(1)
    })
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', request.willQuit)
}
