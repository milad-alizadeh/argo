import { contextBridge, ipcRenderer, webFrame } from 'electron'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_CHANNEL,
  createAppearanceClient,
} from './core/appearance/appearance'
import { COMMAND_CHANNEL } from './core/commands/shortcuts'
import { createProjectClient } from './core/projects/client'
import { PROJECT_CHANNEL } from './core/projects/contract'
import { createSessionClient } from './core/sessions/client'
import {
  SESSION_CLAUDE_START_CHANNEL,
  SESSION_FEED_CHANNEL,
  SESSION_LIST_CHANNEL,
} from './core/sessions/contract'

const SESSION_CHANNELS = {
  list: SESSION_LIST_CHANNEL,
  feed: SESSION_FEED_CHANNEL,
  startClaude: SESSION_CLAUDE_START_CHANNEL,
}

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient((request) => ipcRenderer.invoke(PROJECT_CHANNEL, request)),
  ...createSessionClient((operation, request) =>
    ipcRenderer.invoke(SESSION_CHANNELS[operation], request),
  ),
  ...createAppearanceClient(
    (appearance) => ipcRenderer.invoke(APPEARANCE_CHANNEL, appearance),
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
