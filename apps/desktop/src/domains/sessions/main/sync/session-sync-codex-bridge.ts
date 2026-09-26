import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-machine'

const requestSchema = z.strictObject({
  type: z.literal('codex-request'),
  id: z.string().uuid(),
  method: z.literal('model/list'),
  params: z.strictObject({
    cursor: z.string().optional(),
    limit: z.number().int().positive().optional(),
    includeHidden: z.boolean().optional(),
  }),
})
const responseSchema = z.union([
  z.strictObject({ type: z.literal('codex-response'), id: z.string().uuid(), result: z.unknown() }),
  z.strictObject({ type: z.literal('codex-response'), id: z.string().uuid(), error: z.string() }),
])

export type CodexWorkerRequest = z.infer<typeof requestSchema>
type BridgePort = {
  on: (event: 'message', listener: (message: unknown) => void) => unknown
  once: (event: 'close', listener: () => void) => unknown
  off: (event: 'message', listener: (message: unknown) => void) => unknown
  postMessage: (message: unknown) => void
}

export async function confirmCodexAppServerReady(codexRequest: CodexRequest): Promise<void> {
  await codexRequest('model/list', {}, (value) => value)
}

export function startWhenCodexReady(
  codexRequest: CodexRequest,
  start: () => void,
  fail: (error: unknown) => void,
): () => void {
  let cancelled = false
  void confirmCodexAppServerReady(codexRequest).then(
    () => {
      if (!cancelled) start()
    },
    (error: unknown) => {
      if (!cancelled) fail(error)
    },
  )
  return () => {
    cancelled = true
  }
}

export function validateCodexWorkerRequest(value: unknown): CodexWorkerRequest | null {
  const parsed = requestSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

function rejectInvalidResponse(message: unknown, pending: Map<string, PendingRequest>): void {
  if (typeof message !== 'object' || message === null || !('id' in message)) return
  const parsedId = z.string().uuid().safeParse(message.id)
  if (!parsedId.success) return
  const waiting = pending.get(parsedId.data)
  if (waiting === undefined) return
  pending.delete(parsedId.data)
  clearTimeout(waiting.timer)
  waiting.reject(new Error('Invalid Codex Session sync bridge response.'))
}

export function createCodexWorkerRequest(port: BridgePort, timeoutMs = 9_000): CodexRequest {
  const pending = new Map<string, PendingRequest>()
  const onMessage = (message: unknown) => {
    const parsed = responseSchema.safeParse(message)
    if (!parsed.success) {
      rejectInvalidResponse(message, pending)
      return
    }
    const waiting = pending.get(parsed.data.id)
    if (waiting === undefined) return
    pending.delete(parsed.data.id)
    clearTimeout(waiting.timer)
    if ('error' in parsed.data) waiting.reject(new Error(parsed.data.error))
    else waiting.resolve(parsed.data.result)
  }
  const rejectPending = () => {
    for (const waiting of pending.values()) {
      clearTimeout(waiting.timer)
      waiting.reject(new Error('Codex Session sync bridge closed.'))
    }
    pending.clear()
  }
  port.on('message', onMessage)
  port.once('close', rejectPending)
  return (method, params, parse) => {
    const id = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Codex Session sync bridge request timed out.'))
      }, timeoutMs)
      timer.unref()
      pending.set(id, {
        resolve: (value) => {
          try {
            resolve(parse(value))
          } catch (error) {
            reject(error)
          }
        },
        reject,
        timer,
      })
      port.postMessage({ type: 'codex-request', id, method, params })
    })
  }
}

export function forwardCodexWorkerRequest(
  request: CodexWorkerRequest,
  codexRequest: CodexRequest,
  reply: (message: unknown) => void,
): void {
  void codexRequest(request.method, request.params, (value) => value).then(
    (result) => reply({ type: 'codex-response', id: request.id, result }),
    (error: unknown) => reply({ type: 'codex-response', id: request.id, error: String(error) }),
  )
}

export function installCodexWorkerBridge(port: BridgePort, codexRequest: CodexRequest): () => void {
  let closed = false
  const onMessage = (message: unknown) => {
    const request = validateCodexWorkerRequest(message)
    if (request === null) {
      console.error('Invalid Codex Session sync worker request.', message)
      const id = z
        .string()
        .uuid()
        .safeParse(
          typeof message === 'object' && message !== null && 'id' in message ? message.id : null,
        )
      if (id.success)
        port.postMessage({
          type: 'codex-response',
          id: id.data,
          error: 'Invalid Codex Session sync worker request.',
        })
      return
    }
    forwardCodexWorkerRequest(request, codexRequest, (reply) => {
      if (!closed) port.postMessage(reply)
    })
  }
  port.on('message', onMessage)
  return () => {
    closed = true
    port.off('message', onMessage)
  }
}
