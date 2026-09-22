import { createInterface } from 'node:readline'
import { type RequestID, type RequestParams, readMessage, type WireMessage } from '../protocol'

// Distinguishes "the channel dropped before we got an answer" from an ordinary JSON-RPC error
// response, so a caller can tell an uncertain outcome from a definite rejection (#2580).
export class CodexChannelClosedError extends Error {
  constructor() {
    super('Codex app-server channel closed before this request settled')
  }
}

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
  // Answers a still-open server->client request (`item/tool/requestUserInput`, #1841) by its own
  // request ID, so a listener that claims one can reply without the channel auto-refusing it.
  respond: (id: RequestID, result: unknown) => void
  // A listener returns `true` when it has claimed a server request and answered (or will answer)
  // it itself; the channel auto-refuses only a request no listener claims.
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => void
  onExit: (listener: () => void) => void
  close: () => void
}

type PendingRequests = Map<
  RequestID,
  { resolve: (value: unknown) => void; reject: (error: unknown) => void }
>

type ChannelState = {
  pending: PendingRequests
  notificationListeners: Array<(message: WireMessage) => boolean | undefined>
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
    let claimed = false
    for (const listener of state.notificationListeners) {
      if (listener(message) === true) claimed = true
    }
    if (message.id !== undefined && !claimed) refuse(process, message.id, message.method)
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
    for (const waiting of state.pending.values()) waiting.reject(new CodexChannelClosedError())
    state.pending.clear()
    for (const listener of state.exitListeners) listener()
  })
  return lines
}

// ADR-0024: the cockpit owns one `codex app-server` process per managed Session and speaks
// newline-delimited JSON-RPC over its stdio pipes. A server->client request no listener claims is
// refused rather than left open, because an unanswered approval holds the Turn forever
// (openai/codex#11816); `item/tool/requestUserInput` is claimed and answered for real (#1841),
// while approval requests still go unclaimed and so are still refused (#549).
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
    respond(id, result) {
      process.write(`${JSON.stringify({ id, result })}\n`)
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
