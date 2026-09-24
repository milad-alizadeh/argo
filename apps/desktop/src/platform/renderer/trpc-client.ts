import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, TRPCClientError, type TRPCLink } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { TrpcRequest } from '@/platform/contract/trpc'
import type { AppRouter } from '@/platform/main/trpc-router'

const electronLink: TRPCLink<AppRouter> =
  () =>
  ({ op }) =>
    observable((observer) => {
      if (op.type === 'subscription') {
        observer.error(new Error('tRPC subscriptions are not available on the Electron transport.'))
        return
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
