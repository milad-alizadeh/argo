import type {
  AppearanceMutation,
  AppearancePreference,
  AppearanceState,
  appearanceReadyResultSchema,
} from '@/platform/contract/appearance'
import type { DevelopmentIdentity } from '@/platform/contract/development-identity'
import type { TrpcRequest, TrpcSubscriptionMessage } from '@/platform/contract/trpc-wire'

declare global {
  interface Window {
    argo: {
      getAppearance: () => Promise<AppearanceState>
      setAppearance: (preference: AppearancePreference) => Promise<AppearanceMutation>
      appearanceReady: (
        revision: number,
      ) => Promise<ReturnType<typeof appearanceReadyResultSchema.parse>>
      onAppearanceChanged: (listener: (state: AppearanceState) => void) => () => void
      onCommand: (listener: (command: string) => void) => () => void
      zoomFactor: () => number
      pathForFile: (file: File) => string
      versions: { electron: string; chrome: string }
      development: DevelopmentIdentity | null
      trpc: (
        request: TrpcRequest,
      ) => Promise<{ id: number; result: { data: unknown } } | { id: number; error: unknown }>
      trpcSubscribe: (
        request: TrpcRequest,
        listener: (message: TrpcSubscriptionMessage) => void,
      ) => Promise<() => void>
    }
  }
}
