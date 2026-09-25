import type { AppearanceState } from '@/platform/contract/appearance'
import type { DevelopmentIdentity } from '@/platform/contract/development-identity'

type TrpcRequest = {
  id: number
  path: string
  input: unknown
  type: 'query' | 'mutation' | 'subscription'
}
type TrpcSubscriptionMessage =
  | { id: number; type: 'data'; result: { data: unknown } }
  | { id: number; type: 'error'; error: unknown }
  | { id: number; type: 'complete' }

declare global {
  interface Window {
    argo: {
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
