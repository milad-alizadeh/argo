import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { isTrustedRendererFrame } from '../core/security/is-trusted-renderer-frame'
import { PROJECT_OPEN_CHANNEL, projectError, requestIdentifier } from './contract'
import { openProject } from './open-project'

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { userData: string; rendererURL: string },
): void {
  const registryPath = path.join(storage.userData, 'portable-v1', 'projects.json')
  window.webContents.ipc.handle(PROJECT_OPEN_CHANNEL, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
      return projectError('access-denied', requestIdentifier(request))
    }
    return openProject(request, registryPath)
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}
