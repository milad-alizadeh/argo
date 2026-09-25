import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import './platform/preload/zod-jitless'
import { z } from 'zod'
import {
  PROJECT_SETUP_CHANGED_CHANNEL,
  type ProjectSetupSnapshot,
  projectSetupSnapshotSchema,
} from '@/domains/projects/contract/contract'
import type { AppearanceState } from '@/platform/contract/appearance'
import { APPEARANCE_CHANGED_CHANNEL, isAppearanceState } from '@/platform/contract/appearance'
import { COMMAND_CHANNEL } from '@/platform/contract/commands'
import { isWatchTopic, WATCHED_CHANGED_CHANNEL, type WatchTopic } from '@/platform/contract/watch'
import { developmentIdentityFromArguments } from '@/platform/preload/development-identity'

const TRPC_CHANNEL = 'argo:trpc'
type TrpcSubscriptionMessage =
  | { id: number; type: 'data'; result: { data: unknown } }
  | { id: number; type: 'error'; error: unknown }
  | { id: number; type: 'complete' }

let invalidTrpcSubscriptionMessageCount = 0

function receiveTrpcSubscriptionMessage(
  listener: (message: TrpcSubscriptionMessage) => void,
  message: unknown,
): void {
  const parsed = z
    .discriminatedUnion('type', [
      z.strictObject({
        id: z.number().int().nonnegative(),
        type: z.literal('data'),
        result: z.strictObject({ data: z.unknown() }),
      }),
      z.strictObject({
        id: z.number().int().nonnegative(),
        type: z.literal('error'),
        error: z.unknown(),
      }),
      z.strictObject({
        id: z.number().int().nonnegative(),
        type: z.literal('complete'),
      }),
    ])
    .safeParse(message)
  if (!parsed.success) {
    invalidTrpcSubscriptionMessageCount += 1
    console.error(
      `Received invalid tRPC subscription message #${invalidTrpcSubscriptionMessageCount}:`,
      parsed.error,
    )
    return
  }
  listener(parsed.data)
}

function subscribe<Value>(channel: string, listener: (value: Value) => void): () => void {
  const forward = (_event: Electron.IpcRendererEvent, value: Value) => listener(value)
  ipcRenderer.on(channel, forward)
  return () => ipcRenderer.off(channel, forward)
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
  trpcSubscribe(request: unknown, listener: (message: TrpcSubscriptionMessage) => void) {
    const forward = (_event: Electron.IpcRendererEvent, message: unknown) =>
      receiveTrpcSubscriptionMessage(listener, message)
    ipcRenderer.on(TRPC_CHANNEL, forward)
    const attached = ipcRenderer.invoke(TRPC_CHANNEL, request)
    return attached.then(
      () => () => {
        ipcRenderer.off(TRPC_CHANNEL, forward)
        void ipcRenderer.invoke(TRPC_CHANNEL, {
          id: (request as { id: number }).id,
          type: 'subscriptionStop',
        })
      },
      (error) => {
        ipcRenderer.off(TRPC_CHANNEL, forward)
        throw error
      },
    )
  },
})
