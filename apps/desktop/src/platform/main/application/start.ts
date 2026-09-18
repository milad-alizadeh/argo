import { app } from 'electron'
import { applyStoredAppearance, readAppearance } from '../appearance'
import { setPlatformLanguage } from '../i18n'

export function startDesktopApplication(request: {
  ready: () => Promise<void> | void
  willQuit: () => void
}): void {
  void app.whenReady().then(async () => {
    setPlatformLanguage(app.getLocale())
    applyStoredAppearance(await readAppearance(app.getPath('userData')))
    await request.ready()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', request.willQuit)
}
