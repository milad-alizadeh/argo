import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, TRPCClientError, type TRPCLink } from '@trpc/client'
import { type Observer, observable } from '@trpc/server/observable'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { TrpcRequest } from '@/platform/contract/trpc'
import { trpcSubscriptionMessageSchema } from '@/platform/contract/trpc'
import type { AppRouter } from '@/platform/main/trpc-router'

function receiveSubscriptionMessage<TRouter extends AppRouter>(
  observer: Partial<Observer<{ result: { data: unknown } }, TRPCClientError<TRouter>>>,
  id: number,
  rawMessage: unknown,
): void {
  const parsed = trpcSubscriptionMessageSchema.safeParse(rawMessage)
  if (!parsed.success || parsed.data.id !== id) return
  if (parsed.data.type === 'data') observer.next?.({ result: parsed.data.result })
  if (parsed.data.type === 'error')
    observer.error?.(TRPCClientError.from<TRouter>(parsed.data.error))
  if (parsed.data.type === 'complete') observer.complete?.()
}

const electronLink: TRPCLink<AppRouter> =
  () =>
  ({ op }) =>
    observable((observer) => {
      if (op.type === 'subscription') {
        let stopped = false
        let dispose = () => {}
        window.argo
          .trpcSubscribe(
            { id: op.id, path: op.path, type: op.type, input: op.input },
            (rawMessage) => receiveSubscriptionMessage<AppRouter>(observer, op.id, rawMessage),
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
