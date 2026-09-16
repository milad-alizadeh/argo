// A mock main-process window and IPC surface, for a test that drives a domain through its real
// registration and its real client rather than calling a handler function directly.
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

export const RENDERER_URL = 'file:///argo/index.html'
const UNTRUSTED_URL = 'https://attacker.example/'

type Handler = (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown> | unknown

export function createMockIpcWindow() {
  const handlers = new Map<string, Handler>()
  const window = {
    webContents: {
      id: 1,
      ipc: {
        handle(channel: string, listener: Handler) {
          handlers.set(channel, listener)
        },
      },
    },
    on: () => undefined,
  } as unknown as BrowserWindow

  function invokeFrom(frameURL: string) {
    return async (channel: string, request: unknown): Promise<unknown> => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`no handler registered for channel ${channel}`)
      const event = {
        sender: { id: 1 },
        senderFrame: { url: frameURL },
      } as unknown as IpcMainInvokeEvent
      return handler(event, request)
    }
  }

  return {
    window,
    channels: () => [...handlers.keys()],
    trustedInvoke: invokeFrom(RENDERER_URL),
    untrustedInvoke: invokeFrom(UNTRUSTED_URL),
  }
}
