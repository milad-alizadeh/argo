import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import {
  type CockpitBridge,
  GIT_FACTS_CHANNEL,
  GIT_OPERATION_CHANNEL,
  PROJECT_ACTIVATE_CHANNEL,
  PROJECT_REGISTER_CHANNEL,
  PROJECTION_CHANNEL,
  PROJECTION_READY_CHANNEL,
  type ProjectionDelta,
  SESSION_SPAWN_CHANNEL,
  TERMINAL_ATTACH_CHANNEL,
  TERMINAL_DATA_CHANNEL,
  TERMINAL_INPUT_CHANNEL,
  TERMINAL_RESIZE_CHANNEL,
} from '../shared'

// The Cockpit's IPC surface: the renderer subscribes to main's state projection (ADR-0005)
// and opens the session's terminal. Announcing readiness triggers main to send a hydrating
// snapshot, then stream live deltas; attaching joins the agent's own PTY and streams its output.
const cockpit: CockpitBridge = {
  subscribeProjection(listener) {
    const handler = (_event: IpcRendererEvent, delta: ProjectionDelta): void => listener(delta)
    ipcRenderer.on(PROJECTION_CHANNEL, handler)
    ipcRenderer.send(PROJECTION_READY_CHANNEL)
    return () => {
      ipcRenderer.removeListener(PROJECTION_CHANNEL, handler)
    }
  },
  openTerminal(sessionId, size, onData) {
    // Output is filtered by session on the way in: one window holds many Docks, and every agent
    // streams down the same channel.
    const handler = (_event: IpcRendererEvent, chunk: string, from: string): void => {
      if (from === sessionId) onData(chunk)
    }
    ipcRenderer.on(TERMINAL_DATA_CHANNEL, handler)
    ipcRenderer.send(TERMINAL_ATTACH_CHANNEL, { sessionId, size })
    return {
      write: (data) => ipcRenderer.send(TERMINAL_INPUT_CHANNEL, { sessionId, data }),
      resize: (next) => ipcRenderer.send(TERMINAL_RESIZE_CHANNEL, { sessionId, size: next }),
      dispose: () => {
        ipcRenderer.removeListener(TERMINAL_DATA_CHANNEL, handler)
      },
    }
  },
  readGitFacts(projectId) {
    return ipcRenderer.invoke(GIT_FACTS_CHANNEL, projectId)
  },
  runGitOperation(request) {
    return ipcRenderer.invoke(GIT_OPERATION_CHANNEL, request)
  },
  registerProject() {
    return ipcRenderer.invoke(PROJECT_REGISTER_CHANNEL)
  },
  activateProject(projectId) {
    return ipcRenderer.invoke(PROJECT_ACTIVATE_CHANNEL, projectId)
  },
  spawnSession() {
    return ipcRenderer.invoke(SESSION_SPAWN_CHANNEL)
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
