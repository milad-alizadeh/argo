import { type AnyRouter, callTRPCProcedure, getTRPCErrorShape, TRPCError } from '@trpc/server'
import { isObservable, type Observable } from '@trpc/server/observable'
import { app, type BrowserWindow, ipcMain } from 'electron'
import {
  TRPC_CHANNEL,
  type TrpcRequest,
  trpcRequestSchema,
  trpcSubscriptionStopSchema,
} from '@/platform/contract/trpc'
import { isTrustedRendererFrame } from './security/is-trusted-renderer-frame'

type Context = undefined
type Subscription = { unsubscribe: () => void }
type SubscriptionRequest = Omit<TrpcRequest, 'type'> & { type: 'subscription' }

function asTRPCError(cause: unknown): TRPCError {
  return cause instanceof TRPCError
    ? cause
    : new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause })
}

function errorShape<TRouter extends AnyRouter>(request: {
  router: TRouter
  input: TrpcRequest
  context: Context
  cause: unknown
}) {
  const { router, input, context, cause } = request
  return getTRPCErrorShape({
    config: router._def._config,
    error: asTRPCError(cause),
    type: input.type,
    path: input.path,
    input: input.input,
    ctx: context,
  })
}

async function startSubscription<TRouter extends AnyRouter>(request: {
  router: TRouter
  context: Context
  input: SubscriptionRequest
  subscriptions: Map<number, Subscription>
  send: (message: unknown) => void
}): Promise<void> {
  const { input, router, context, subscriptions, send } = request
  let active = true
  let subscription: Subscription | undefined
  const pending: Subscription = {
    unsubscribe: () => {
      active = false
      subscription?.unsubscribe()
    },
  }
  subscriptions.set(input.id, pending)
  try {
    const result = await callTRPCProcedure({
      router,
      path: input.path,
      type: input.type,
      ctx: context,
      signal: undefined,
      batchIndex: 0,
      getRawInput: async () => input.input,
    })
    if (!isObservable(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Subscription procedures must return an observable.',
      })
    }
    if (!active) return
    let finished = false
    subscription = (result as Observable<unknown, unknown>).subscribe({
      next: (data) => send({ id: input.id, type: 'data', result: { data } }),
      error: (cause) => {
        send({ id: input.id, type: 'error', error: errorShape({ router, input, context, cause }) })
        finished = true
        subscriptions.delete(input.id)
      },
      complete: () => {
        finished = true
        send({ id: input.id, type: 'complete' })
        subscriptions.delete(input.id)
      },
    })
    if (!active || finished) subscription.unsubscribe()
    else subscriptions.set(input.id, subscription)
  } catch (cause) {
    if (active)
      send({ id: input.id, type: 'error', error: errorShape({ router, input, context, cause }) })
  } finally {
    if (subscriptions.get(input.id) === pending) subscriptions.delete(input.id)
  }
}

export function attachTrpcTransport<TRouter extends AnyRouter>(request: {
  window: BrowserWindow
  rendererURL: string
  router: TRouter
  context: Context
}): () => void {
  const subscriptions = new Map<number, Subscription>()
  const stopSubscription = (id: number): void => {
    subscriptions.get(id)?.unsubscribe()
    subscriptions.delete(id)
  }
  const stopAllSubscriptions = (): void => {
    for (const id of subscriptions.keys()) stopSubscription(id)
  }
  const sendSubscriptionMessage = (message: unknown): void => {
    if (!request.window.webContents.isDestroyed())
      request.window.webContents.send(TRPC_CHANNEL, message)
  }
  const handler = async (event: Electron.IpcMainInvokeEvent, rawInput: unknown) => {
    if (!isTrustedRendererFrame(event, request.window, request.rendererURL)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Renderer frame is not trusted.' })
    }
    const stop = trpcSubscriptionStopSchema.safeParse(rawInput)
    if (stop.success) {
      stopSubscription(stop.data.id)
      return { id: stop.data.id, result: { data: null } }
    }
    const input = trpcRequestSchema.parse(rawInput)
    if (input.type === 'subscription') {
      stopSubscription(input.id)
      await startSubscription({
        router: request.router,
        context: request.context,
        input,
        subscriptions,
        send: sendSubscriptionMessage,
      })
      return { id: input.id, result: { data: null } }
    }
    try {
      const data = await callTRPCProcedure({
        router: request.router,
        path: input.path,
        type: input.type,
        ctx: request.context,
        signal: undefined,
        batchIndex: 0,
        getRawInput: async () => input.input,
      })
      return { id: input.id, result: { data } }
    } catch (cause) {
      return {
        id: input.id,
        error: errorShape({ router: request.router, input, context: request.context, cause }),
      }
    }
  }
  ipcMain.handle(TRPC_CHANNEL, handler)
  const stopOnNavigation = () => stopAllSubscriptions()
  request.window.webContents.on('did-start-navigation', stopOnNavigation)
  request.window.webContents.once('destroyed', stopOnNavigation)
  app.on('will-quit', stopOnNavigation)
  return () => {
    stopAllSubscriptions()
    request.window.webContents.removeListener('did-start-navigation', stopOnNavigation)
    request.window.webContents.removeListener('destroyed', stopOnNavigation)
    app.removeListener('will-quit', stopOnNavigation)
    ipcMain.removeHandler(TRPC_CHANNEL)
  }
}
