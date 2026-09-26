import { expect, mock, test } from 'bun:test'
import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

type Handler = (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>

let handler: Handler | undefined
const appListeners = new Map<string, () => void>()
const ipcMain = {
  handle: (_channel: string, next: Handler) => {
    handler = next
  },
  removeHandler: () => {
    handler = undefined
  },
}
const app = {
  on: (event: string, listener: () => void) => appListeners.set(event, listener),
  removeListener: (event: string) => appListeners.delete(event),
}
mock.module('electron', () => ({ app, ipcMain }))

const { attachTrpcTransport } = await import('../../src/platform/main/trpc-transport')

function getHandler(): Handler {
  if (handler === undefined) throw new Error('Transport handler is not attached.')
  return handler
}

const t = initTRPC.create()

function host() {
  const sent: unknown[] = []
  const listeners = new Map<string, () => void>()
  let destroyed = false
  const webContents = {
    id: 7,
    isDestroyed: () => destroyed,
    send: (_channel: string, message: unknown) => sent.push(message),
    on: (event: string, listener: () => void) => listeners.set(event, listener),
    once: (event: string, listener: () => void) => listeners.set(event, listener),
    removeListener: (event: string) => listeners.delete(event),
  }
  const window = {
    get webContents() {
      if (destroyed) throw new Error('BrowserWindow is destroyed.')
      return webContents
    },
  } as unknown as BrowserWindow
  return {
    window,
    sent,
    event: {
      sender: webContents,
      senderFrame: { url: 'http://localhost/#/sessions' },
    } as unknown as IpcMainInvokeEvent,
    navigate: () => listeners.get('did-start-navigation')?.(),
    destroy: () => {
      destroyed = true
      listeners.get('destroyed')?.()
    },
  }
}

test('trusted tRPC transport delivers the initial value and later events, then stops on unsubscribe', async () => {
  let emit: ((value: string) => void) | undefined
  let unsubscribed = false
  const router = t.router({
    updates: t.procedure.subscription(() =>
      observable<string>((observer) => {
        let active = true
        observer.next('initial')
        emit = (value) => {
          if (active) observer.next(value)
        }
        return () => {
          active = false
          unsubscribed = true
        }
      }),
    ),
    ping: t.procedure.query(() => 'pong'),
  })
  const hostWindow = host()
  handler = undefined
  const detach = attachTrpcTransport({
    window: hostWindow.window,
    rendererURL: 'http://localhost/',
    router,
    context: undefined,
  })
  try {
    await getHandler()(hostWindow.event, {
      id: 1,
      path: 'updates',
      type: 'subscription',
      input: undefined,
    })
    expect(hostWindow.sent).toEqual([{ id: 1, type: 'data', result: { data: 'initial' } }])
    emit?.('later')
    expect(hostWindow.sent).toHaveLength(2)
    await getHandler()(hostWindow.event, { id: 1, type: 'subscriptionStop' })
    expect(unsubscribed).toBe(true)
    emit?.('ignored')
    expect(hostWindow.sent).not.toContainEqual({ id: 1, type: 'data', result: { data: 'ignored' } })
    await expect(
      getHandler()(hostWindow.event, { id: 2, path: 'ping', type: 'query', input: undefined }),
    ).resolves.toEqual({ id: 2, result: { data: 'pong' } })
  } finally {
    detach()
  }
})

test('trusted tRPC transport stops on navigation and shutdown, and does not deliver to destroyed contents', async () => {
  let emit: ((value: string) => void) | undefined
  let unsubscribed = 0
  const router = t.router({
    updates: t.procedure.subscription(() =>
      observable<string>((observer) => {
        emit = (value) => observer.next(value)
        return () => {
          unsubscribed += 1
        }
      }),
    ),
  })
  const hostWindow = host()
  handler = undefined
  const detach = attachTrpcTransport({
    window: hostWindow.window,
    rendererURL: 'http://localhost/',
    router,
    context: undefined,
  })
  try {
    await getHandler()(hostWindow.event, {
      id: 3,
      path: 'updates',
      type: 'subscription',
      input: undefined,
    })
    hostWindow.navigate()
    expect(unsubscribed).toBe(1)
    await getHandler()(hostWindow.event, {
      id: 3,
      path: 'updates',
      type: 'subscription',
      input: undefined,
    })
    appListeners.get('will-quit')?.()
    hostWindow.destroy()
    emit?.('ignored')
    expect(hostWindow.sent).toEqual([])
  } finally {
    detach()
  }
})

test('trusted tRPC transport rejects an untrusted frame before it can subscribe', async () => {
  const router = t.router({ updates: t.procedure.subscription(() => observable(() => {})) })
  const hostWindow = host()
  handler = undefined
  const detach = attachTrpcTransport({
    window: hostWindow.window,
    rendererURL: 'http://localhost/',
    router,
    context: undefined,
  })
  try {
    const untrusted = {
      ...hostWindow.event,
      senderFrame: { url: 'https://attacker.test/' },
    } as unknown as IpcMainInvokeEvent
    await expect(
      getHandler()(untrusted, { id: 4, path: 'updates', type: 'subscription', input: undefined }),
    ).rejects.toThrow('Renderer frame is not trusted.')
    expect(hostWindow.sent).toEqual([])
  } finally {
    detach()
  }
})
