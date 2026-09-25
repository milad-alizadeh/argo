import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import './platform/preload/zod-jitless'
import {
  PROJECT_SETUP_CHANGED_CHANNEL,
  type ProjectSetupSnapshot,
  projectSetupSnapshotSchema,
} from '@/domains/projects/contract/contract'
import type { AppearanceState } from '@/platform/contract/appearance'
import { APPEARANCE_CHANGED_CHANNEL, isAppearanceState } from '@/platform/contract/appearance'
import { COMMAND_CHANNEL } from '@/platform/contract/commands'
import { TRPC_CHANNEL } from '@/platform/contract/trpc'
import { isWatchTopic, WATCHED_CHANGED_CHANNEL, type WatchTopic } from '@/platform/contract/watch'
import { developmentIdentityFromArguments } from '@/platform/preload/development-identity'

type Subscription = {
  listeners: Set<(value: unknown) => void>
  forward: (_event: Electron.IpcRendererEvent, value: unknown) => void
}

const subscriptions = new Map<string, Subscription>()

function subscribe<Value>(channel: string, listener: (value: Value) => void): () => void {
  let subscription = subscriptions.get(channel)
  if (!subscription) {
    const listeners = new Set<(value: unknown) => void>()
    const forward = (_event: Electron.IpcRendererEvent, value: unknown) => {
      for (const current of listeners) current(value)
    }
    subscription = { listeners, forward }
    subscriptions.set(channel, subscription)
    ipcRenderer.on(channel, forward)
  }

  const current = listener as (value: unknown) => void
  subscription.listeners.add(current)
  return () => {
    const active = subscriptions.get(channel)
    if (!active) return
    active.listeners.delete(current)
    if (active.listeners.size === 0) {
      ipcRenderer.off(channel, active.forward)
      subscriptions.delete(channel)
    }
  }
}

contextBridge.exposeInMainWorld('argo', {
  onWatchedChanged(listener: (topic: WatchTopic) => void) {
    return subscribe<unknown>(WATCHED_CHANGED_CHANNEL, (value) => {
      if (isWatchTopic(value)) listener(value)
    })
  },
  onAppearanceChanged(listener: (state: AppearanceState) => void) {
    return subscribe<unknown>(APPEARANCE_CHANGED_CHANNEL, (value) => {
      if (isAppearanceState(value)) listener(value)
    })
  },
  onCommand(listener: (command: string) => void) {
    return subscribe<unknown>(COMMAND_CHANNEL, (value) => {
      if (typeof value === 'string') listener(value)
    })
  },
  onProjectSetupChanged(listener: (snapshot: ProjectSetupSnapshot) => void) {
    return subscribe<unknown>(PROJECT_SETUP_CHANGED_CHANNEL, (value) => {
      const parsed = projectSetupSnapshotSchema.safeParse(value)
      if (parsed.success) listener(parsed.data)
    })
  },
  zoomFactor: () => webFrame.getZoomFactor(),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  development: developmentIdentityFromArguments(process.argv),
  trpc: (request: unknown) => ipcRenderer.invoke(TRPC_CHANNEL, request),
})
