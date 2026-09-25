import type { ProjectSetupSnapshot } from '@/domains/projects/contract/contract'
import type { AppearanceState } from '@/platform/contract/appearance'
import type { DevelopmentIdentity } from '@/platform/contract/development-identity'
import type { TrpcRequest } from '@/platform/contract/trpc'
import type { WatchTopic } from '@/platform/contract/watch'

declare global {
  interface Window {
    argo: {
      onWatchedChanged: (listener: (topic: WatchTopic) => void) => () => void
      onAppearanceChanged: (listener: (state: AppearanceState) => void) => () => void
      onCommand: (listener: (command: string) => void) => () => void
      onProjectSetupChanged: (listener: (snapshot: ProjectSetupSnapshot) => void) => () => void
      zoomFactor: () => number
      pathForFile: (file: File) => string
      versions: { electron: string; chrome: string }
      development: DevelopmentIdentity | null
      trpc: (
        request: TrpcRequest,
      ) => Promise<{ id: number; result: { data: unknown } } | { id: number; error: unknown }>
      trpcSubscribe: (
        request: TrpcRequest,
        listener: (message: unknown) => void,
      ) => Promise<() => void>
    }
  }
}
