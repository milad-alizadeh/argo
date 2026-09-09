import { contextBridge, ipcRenderer } from 'electron'
import { createProjectClient } from './projects/client'
import { PROJECT_OPEN_CHANNEL } from './projects/contract'

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient((request) => ipcRenderer.invoke(PROJECT_OPEN_CHANNEL, request)),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
