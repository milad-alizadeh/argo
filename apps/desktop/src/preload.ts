import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import './platform/preload/zod-jitless'
import { z } from 'zod'
import type { AppearanceState } from '@/platform/contract/appearance'
import { APPEARANCE_CHANGED_CHANNEL, isAppearanceState } from '@/platform/contract/appearance'
import { COMMAND_CHANNEL } from '@/platform/contract/commands'
import { developmentIdentityFromArguments } from '@/platform/preload/development-identity'

type Subscription = {
  listeners: Set<(value: unknown) => void>
  forward: (_event: Electron.IpcRendererEvent, value: unknown) => void
}

const subscriptions = new Map<string, Subscription>()

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
  zoomFactor: () => webFrame.getZoomFactor(),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  versions: { electron: process.versions.electron, chrome: process.versions.chrome },
  development: developmentIdentityFromArguments(process.argv),
  trpc: (request: unknown) => ipcRenderer.invoke(TRPC_CHANNEL, request),
  trpcSubscribe(request: unknown, listener: (message: TrpcSubscriptionMessage) => void) {
    const unsubscribe = subscribe<unknown>(TRPC_CHANNEL, (message) =>
      receiveTrpcSubscriptionMessage(listener, message),
    )
    const attached = ipcRenderer.invoke(TRPC_CHANNEL, request)
    return attached.then(
      () => () => {
        unsubscribe()
        void ipcRenderer.invoke(TRPC_CHANNEL, {
          id: (request as { id: number }).id,
          type: 'subscriptionStop',
        })
      },
      (error) => {
        unsubscribe()
        throw error
      },
    )
  },
})
