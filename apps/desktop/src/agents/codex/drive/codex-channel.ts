import { createInterface } from 'node:readline'
import type { RequestID, RequestParams, WireMessage } from './protocol'
import { readMessage } from './protocol'

export type CodexProcess = {
  stdout: NodeJS.ReadableStream
  write: (line: string) => void
  kill: () => void
  onExit: (listener: () => void) => void
}

export type CodexChannel = {
  notify: (method: 'initialized') => void
  request: <Method extends keyof RequestParams, Result>(
    method: Method,
    params: RequestParams[Method],
    decode: (value: unknown) => Result,
  ) => Promise<Result>
  onNotification: (listener: (message: WireMessage) => void) => void
  onExit: (listener: () => void) => void
  close: () => void
}

// ADR-0024: the cockpit owns one `codex app-server` process per managed Session and speaks
// newline-delimited JSON-RPC over its stdio pipes. A server->client request this adapter has no
// answer for is refused rather than left open, because an unanswered approval holds the Turn for
// ever (openai/codex#11816) and #1839's slice does not build the approval UI yet (#1841 does).
export function openCodexChannel(process: CodexProcess): CodexChannel {
  let sequence = 0
  const pending = new Map<RequestID, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>()
  const notificationListeners: Array<(message: WireMessage) => void> = []
  const exitListeners: Array<() => void> = []

  const send = (message: { id?: RequestID; method: string; params?: unknown }) => {
    process.write(`${JSON.stringify(message)}\n`)
  }

  const lines = createInterface({ input: process.stdout })
  lines.on('line', (line) => {
    let message: WireMessage
    try {
      message = readMessage(line)
    } catch {
      return
    }
    if ('method' in message) {
      if (message.id !== undefined) refuse(message.id, message.method)
      for (const listener of notificationListeners) listener(message)
      return
    }
    const waiting = pending.get(message.id)
    if (waiting === undefined) return
    pending.delete(message.id)
    if ('error' in message) waiting.reject(new Error(message.error.message))
    else waiting.resolve(message.result)
  })

  function refuse(id: RequestID, method: string) {
    process.write(
      `${JSON.stringify({
        id,
        error: { code: -32601, message: `Argo does not answer ${method} yet.` },
      })}\n`,
    )
  }

  process.onExit(() => {
    for (const waiting of pending.values()) waiting.reject(new Error('Codex exited'))
    pending.clear()
    for (const listener of exitListeners) listener()
  })

  return {
    notify(method) {
      send({ method })
    },
    request(method, params, decode) {
      const id = ++sequence
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => {
            try {
              resolve(decode(value))
            } catch (error) {
              reject(error)
            }
          },
          reject,
        })
        send({ id, method, params })
      })
    },
    onNotification(listener) {
      notificationListeners.push(listener)
    },
    onExit(listener) {
      exitListeners.push(listener)
    },
    close() {
      lines.close()
      process.kill()
    },
  }
}
