import { callTRPCProcedure, getTRPCErrorShape, TRPCError } from '@trpc/server'
import { type BrowserWindow, ipcMain } from 'electron'
import type { SessionRouterContext } from '@/domains/sessions/main/session-router'
import { TRPC_CHANNEL, trpcRequestSchema } from '@/platform/contract/trpc'
import { isTrustedRendererFrame } from './security/is-trusted-renderer-frame'
import type { AppRouter } from './trpc-router'

type Context = SessionRouterContext

export function attachTrpcTransport(request: {
  window: BrowserWindow
  rendererURL: string
  router: AppRouter
  context: Context
}): () => void {
  const handler = async (event: Electron.IpcMainInvokeEvent, rawInput: unknown) => {
    if (!isTrustedRendererFrame(event, request.window, request.rendererURL)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Renderer frame is not trusted.' })
    }
    const input = trpcRequestSchema.parse(rawInput)
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
      const error =
        cause instanceof TRPCError ? cause : new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause })
      return {
        id: input.id,
        error: getTRPCErrorShape({
          config: request.router._def._config,
          error,
          type: input.type,
          path: input.path,
          input: input.input,
          ctx: request.context,
        }),
      }
    }
  }
  ipcMain.handle(TRPC_CHANNEL, handler)
  return () => ipcMain.removeHandler(TRPC_CHANNEL)
}
