import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { z } from 'zod'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_OPERATIONS,
  createAppearanceClient,
} from './core/appearance/appearance'
import { COMMAND_CHANNEL } from './core/commands/shortcuts'
import { createProjectClient } from './core/projects/client'
import { PROJECT_OPERATIONS } from './core/projects/operations'
import { createSessionClient } from './core/sessions/client'
import { SESSION_OPERATIONS } from './core/sessions/operations'

// Electron's isolated preload world blocks Zod's generated validator path.
z.config({ jitless: true })

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient((operation, request) =>
    ipcRenderer.invoke(PROJECT_OPERATIONS[operation].channel, request),
  ),
  ...createSessionClient((operation, request) =>
    ipcRenderer.invoke(SESSION_OPERATIONS[operation].channel, request),
  ),
  ...createAppearanceClient(
    (operation, request) => ipcRenderer.invoke(APPEARANCE_OPERATIONS[operation].channel, request),
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
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
