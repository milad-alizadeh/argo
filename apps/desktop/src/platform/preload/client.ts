import { type AppearanceClient, createAppearanceClient } from '@/platform/preload/appearance'
import { createWatchClient, type WatchClient } from '@/platform/preload/watch'
import { APPEARANCE_CHANGED_CHANNEL } from '@/platform/shared/appearance'
import { COMMAND_CHANNEL } from '@/platform/shared/commands'
import type { DevelopmentIdentity } from '@/platform/shared/development-identity'
import { WATCHED_CHANGED_CHANNEL } from '@/platform/shared/watch'

type Subscribe = (channel: string, listener: (value: unknown) => void) => () => void

export type PlatformClient = AppearanceClient &
  WatchClient & {
    onCommand(listener: (command: string) => void): () => void
    zoomFactor(): number
    pathForFile(file: File): string
    versions: { electron: string; chrome: string }
    development: DevelopmentIdentity | null
  }

export function createPlatformClient(request: {
  invoke: (channel: string, value: unknown) => Promise<unknown>
  subscribe: Subscribe
  zoomFactor: () => number
  pathForFile: (file: File) => string
  versions: PlatformClient['versions']
  development: DevelopmentIdentity | null
}): PlatformClient {
  return {
    ...createAppearanceClient(request.invoke, (listener) =>
      request.subscribe(APPEARANCE_CHANGED_CHANNEL, listener),
    ),
    ...createWatchClient((listener) => request.subscribe(WATCHED_CHANGED_CHANNEL, listener)),
    onCommand(listener) {
      return request.subscribe(COMMAND_CHANNEL, (command) => {
        if (typeof command === 'string') listener(command)
      })
    },
    zoomFactor: request.zoomFactor,
    pathForFile: request.pathForFile,
    versions: request.versions,
    development: request.development,
  }
}
