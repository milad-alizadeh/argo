import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, TRPCClientError, type TRPCLink } from '@trpc/client'
import { type Observer, observable } from '@trpc/server/observable'
import type { inferRouterOutputs } from '@trpc/server'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@/platform/main/trpc-router'

export type RouterOutputs = inferRouterOutputs<AppRouter>

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

function assertNever(value: never): never {
  throw new Error(`Unknown tRPC subscription message: ${String(value)}`)
}

function receiveSubscriptionMessage<TRouter extends AppRouter>(
  observer: Partial<Observer<{ result: { data: unknown } }, TRPCClientError<TRouter>>>,
  id: number,
  message: TrpcSubscriptionMessage,
): void {
  if (message.id !== id) return
  switch (message.type) {
    case 'data':
      observer.next?.({ result: message.result })
      break
    case 'error':
      observer.error?.(TRPCClientError.from<TRouter>({ error: message.error }))
      break
    case 'complete':
      observer.complete?.()
      break
    default:
      assertNever(message)
  }
}

const electronLink: TRPCLink<AppRouter> =
  () =>
  ({ op }) =>
    observable((observer) => {
      if (op.type === 'subscription') {
        let stopped = false
        let dispose = () => {}
        window.argo
          .trpcSubscribe({ id: op.id, path: op.path, type: op.type, input: op.input }, (message) =>
            receiveSubscriptionMessage<AppRouter>(observer, op.id, message),
          )
          .then((unsubscribe) => {
            if (stopped) unsubscribe()
            else dispose = unsubscribe
          })
          .catch((error) => observer.error(TRPCClientError.from<AppRouter>(error)))
        return () => {
          stopped = true
          dispose()
        }
      }
      const request: TrpcRequest = { id: op.id, path: op.path, type: op.type, input: op.input }
      window.argo
        .trpc(request)
        .then((response) => {
          if ('error' in response) {
            observer.error(TRPCClientError.from<AppRouter>(response))
            return
          }
          observer.next({ result: response.result })
          observer.complete()
        })
        .catch((error) => observer.error(TRPCClientError.from<AppRouter>(error)))
    })

const client = createTRPCClient<AppRouter>({ links: [electronLink] })
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client,
  queryClient,
})

export { client as trpcClient }
