import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { createSessionClient } from './core/sessions/client'
import { SESSION_FEED_CHANNEL, SESSION_LIST_CHANNEL } from './core/sessions/contract'
import { createProjectClient } from './projects/client'
import { PROJECT_OPEN_CHANNEL } from './projects/contract'

const SESSION_CHANNELS = { list: SESSION_LIST_CHANNEL, feed: SESSION_FEED_CHANNEL }

// The renderer receives named operations, never the IPC object or a caller-selected channel.
contextBridge.exposeInMainWorld('argo', {
  ...createProjectClient((request) => ipcRenderer.invoke(PROJECT_OPEN_CHANNEL, request)),
  ...createSessionClient((operation, request) =>
    ipcRenderer.invoke(SESSION_CHANNELS[operation], request),
  ),
  // The renderer owns every Feed height, and zoom is one of the three things that invalidate a
  // cached one (ADR-0033 rule 6). Only this side can read it, so it is exposed by name.
  zoomFactor: () => webFrame.getZoomFactor(),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
