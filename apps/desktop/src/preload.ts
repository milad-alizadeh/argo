import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import './platform/preload/zod-jitless'
import { createCodexCompactionClient } from './agents/codex/compaction/compaction'
import { createSessionClient } from './core/sessions/client'
import { createAccountClient } from './domains/accounts/preload/client'
import { createProjectClient } from './domains/projects/preload/client'
import { createTicketClient } from './domains/tickets/preload/client'
import { createPlatformClient } from './platform/preload/client'
import { developmentIdentityFromArguments } from './platform/preload/development-identity'

const invoke = (channel: string, request: unknown) => ipcRenderer.invoke(channel, request)

const subscribe = (channel: string, listener: (value: unknown) => void) => {
  const forward = (_event: unknown, value: unknown) => listener(value)
  ipcRenderer.on(channel, forward)
  return () => {
    ipcRenderer.off(channel, forward)
  }
}

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient(invoke),
  ...createAccountClient(invoke),
  ...createTicketClient(invoke),
  ...createSessionClient(invoke),
  ...createCodexCompactionClient(invoke),
  ...createPlatformClient({
    invoke,
    subscribe,
    zoomFactor: () => webFrame.getZoomFactor(),
    pathForFile: (file) => webUtils.getPathForFile(file),
    versions: { electron: process.versions.electron, chrome: process.versions.chrome },
    development: developmentIdentityFromArguments(process.argv),
  }),
})
