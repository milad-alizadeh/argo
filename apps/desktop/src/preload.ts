import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import './zod-jitless'
import { createAccountClient } from './core/accounts/client'
import { APPEARANCE_CHANGED_CHANNEL, createAppearanceClient } from './core/appearance/appearance'
import { COMMAND_CHANNEL } from './core/commands/shortcuts'
import { createProjectClient } from './core/projects/client'
import { createSessionClient } from './core/sessions/client'
import { createTicketClient } from './core/tickets/client'

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient((channel, request) => ipcRenderer.invoke(channel, request)),
  ...createAccountClient((channel, request) => ipcRenderer.invoke(channel, request)),
  ...createTicketClient((channel, request) => ipcRenderer.invoke(channel, request)),
  ...createSessionClient((channel, request) => ipcRenderer.invoke(channel, request)),
  ...createAppearanceClient(
    (channel, request) => ipcRenderer.invoke(channel, request),
    (listener) => {
      const forward = (_event: unknown, state: unknown) => listener(state)
      ipcRenderer.on(APPEARANCE_CHANGED_CHANNEL, forward)
      return () => {
        ipcRenderer.off(APPEARANCE_CHANGED_CHANNEL, forward)
      }
    },
  ),
  // A menu item names a command and nothing else, so the renderer runs the same action the
  // on-screen control runs. The disposer is what keeps a remounted component from opening the
  // folder chooser twice.
  onCommand(listener: (command: string) => void) {
    const forward = (_event: unknown, command: unknown) => {
      if (typeof command === 'string') listener(command)
    }
    ipcRenderer.on(COMMAND_CHANNEL, forward)
    return () => {
      ipcRenderer.off(COMMAND_CHANNEL, forward)
    }
  },
  zoomFactor: () => webFrame.getZoomFactor(),
  // A dropped File is a page object; only the preload world can resolve it back to the absolute
  // path a native dialog would have handed the renderer directly.
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
