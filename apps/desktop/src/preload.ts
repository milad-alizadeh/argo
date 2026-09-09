import { contextBridge } from 'electron'

// The renderer never gets Node. It gets one narrow, named surface, and this scaffold's surface
// is deliberately the smallest thing that proves the bridge is wired.
contextBridge.exposeInMainWorld('argo', {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
