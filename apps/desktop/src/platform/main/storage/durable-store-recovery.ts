import { app, dialog } from 'electron'
import { platformText } from '@/platform/main/i18n'
import { restoreSharedDatabase } from '@/platform/main/storage/shared-database'

export function recoverDurableStore<Result>(request: {
  databasePath: string
  backupPath: string
  open: () => Result
}): Result {
  try {
    return request.open()
  } catch {
    const restore = dialog.showMessageBoxSync({
      type: 'error',
      title: platformText('dialog.restoreData.title'),
      message: platformText('dialog.restoreData.message'),
      detail: platformText('dialog.restoreData.detail'),
      buttons: [
        platformText('dialog.restoreData.restore'),
        platformText('dialog.restoreData.quit'),
      ],
      defaultId: 0,
      cancelId: 1,
    })
    if (restore !== 0) return app.exit(1) as never
    if (!restoreSharedDatabase(request.databasePath, request.backupPath)) {
      dialog.showErrorBox(
        platformText('dialog.restoreData.title'),
        platformText('dialog.restoreData.noBackup'),
      )
      return app.exit(1) as never
    }
    try {
      return request.open()
    } catch {
      dialog.showErrorBox(
        platformText('dialog.restoreData.title'),
        platformText('dialog.restoreData.restoreFailed'),
      )
      return app.exit(1) as never
    }
  }
}
