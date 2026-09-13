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

type PendingRequests = Map<
  RequestID,
  { resolve: (value: unknown) => void; reject: (error: unknown) => void }
>

type ChannelState = {
  pending: PendingRequests
  notificationListeners: Array<(message: WireMessage) => void>
  exitListeners: Array<() => void>
}

function refuse(process: CodexProcess, id: RequestID, method: string) {
  process.write(
    `${JSON.stringify({
      id,
      error: { code: -32601, message: `Argo does not answer ${method} yet.` },
    })}\n`,
  )
}

function handleLine(process: CodexProcess, state: ChannelState, line: string) {
  let message: WireMessage
  try {
    message = readMessage(line)
  } catch {
    return
  }
  if ('method' in message) {
    if (message.id !== undefined) refuse(process, message.id, message.method)
    for (const listener of state.notificationListeners) listener(message)
    return
  }
  const waiting = state.pending.get(message.id)
  if (waiting === undefined) return
  state.pending.delete(message.id)
  if ('error' in message) waiting.reject(new Error(message.error.message))
  else waiting.resolve(message.result)
}

function wireInbound(process: CodexProcess, state: ChannelState) {
  const lines = createInterface({ input: process.stdout })
  lines.on('line', (line) => handleLine(process, state, line))
  process.onExit(() => {
    for (const waiting of state.pending.values()) waiting.reject(new Error('Codex exited'))
    state.pending.clear()
    for (const listener of state.exitListeners) listener()
  })
  return lines
}

// ADR-0024: the cockpit owns one `codex app-server` process per managed Session and speaks
// newline-delimited JSON-RPC over its stdio pipes. A server->client request this adapter has no
// answer for is refused rather than left open, because an unanswered approval holds the Turn for
// ever (openai/codex#11816) and #1839's slice does not build the approval UI yet (#1841 does).
export function openCodexChannel(process: CodexProcess): CodexChannel {
  let sequence = 0
  const state: ChannelState = { pending: new Map(), notificationListeners: [], exitListeners: [] }
  const { pending, notificationListeners, exitListeners } = state

  const send = (message: { id?: RequestID; method: string; params?: unknown }) => {
    process.write(`${JSON.stringify(message)}\n`)
  }

  const lines = wireInbound(process, state)

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
