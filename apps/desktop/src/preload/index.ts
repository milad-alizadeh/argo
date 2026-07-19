import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import {
  type CockpitBridge,
  PROJECTION_CHANNEL,
  PROJECTION_READY_CHANNEL,
  type ProjectionDelta,
} from '../shared'

// The Cockpit's IPC surface: the renderer subscribes to main's state projection
// (ADR-0005). Announcing readiness triggers main to send a hydrating snapshot, then
// stream live deltas. Later tickets add the steering PTY channel alongside this.
const cockpit: CockpitBridge = {
  subscribeProjection(listener) {
    const handler = (_event: IpcRendererEvent, delta: ProjectionDelta): void => listener(delta)
    ipcRenderer.on(PROJECTION_CHANNEL, handler)
    ipcRenderer.send(PROJECTION_READY_CHANNEL)
    return () => {
      ipcRenderer.removeListener(PROJECTION_CHANNEL, handler)
    }
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('cockpit', cockpit)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.cockpit = cockpit
}
