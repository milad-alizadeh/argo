import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import {
  type CockpitBridge,
  PROJECTION_CHANNEL,
  PROJECTION_READY_CHANNEL,
  type ProjectionDelta,
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_DATA_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
} from '../shared'

// The Cockpit's IPC surface: the renderer subscribes to main's state projection (ADR-0005)
// and opens the live shell. Announcing readiness triggers main to send a hydrating snapshot,
// then stream live deltas; attaching triggers main to spawn the PTY, then stream its output.
const cockpit: CockpitBridge = {
  subscribeProjection(listener) {
    const handler = (_event: IpcRendererEvent, delta: ProjectionDelta): void => listener(delta)
    ipcRenderer.on(PROJECTION_CHANNEL, handler)
    ipcRenderer.send(PROJECTION_READY_CHANNEL)
    return () => {
      ipcRenderer.removeListener(PROJECTION_CHANNEL, handler)
    }
  },
  openTerminal(size, onData) {
    const handler = (_event: IpcRendererEvent, chunk: string): void => onData(chunk)
    ipcRenderer.on(TERMINAL_DATA_CHANNEL, handler)
    ipcRenderer.send(TERMINAL_ATTACH_CHANNEL, size)
    return {
      write: (data) => ipcRenderer.send(TERMINAL_INPUT_CHANNEL, data),
      resize: (next) => ipcRenderer.send(TERMINAL_RESIZE_CHANNEL, next),
      dispose: () => {
        ipcRenderer.removeListener(TERMINAL_DATA_CHANNEL, handler)
      },
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
