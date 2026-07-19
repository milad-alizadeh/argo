import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge } from 'electron'

// The skeleton only exposes the electron-toolkit bridge. Later tickets add the
// Cockpit's own IPC surface here: the main → renderer delta projection (ADR-0005)
// and the steering PTY channel.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
}
