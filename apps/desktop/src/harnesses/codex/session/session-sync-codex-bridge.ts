import { randomUUID } from 'node:crypto'
import type { ActorRefFrom } from 'xstate'
import { z } from 'zod'
import type { SessionSyncWorkerBridge } from '@/domains/sessions/main/sync/session-sync-worker-bridge'
import {
  CODEX_THREAD_SOURCE_KINDS,
  type CodexRequest,
  type codexAppServerMachine,
  type RequestParams,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'

export type { CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-machine'
export type CodexWorkerReadRequest = {
  <Result>(
    method: 'model/list',
    params: RequestParams['model/list'],
    parse: (value: unknown) => Result,
  ): Promise<Result>
  <Result>(
    method: 'thread/list',
    params: RequestParams['thread/list'],
    parse: (value: unknown) => Result,
  ): Promise<Result>
  <Result>(
    method: 'thread/read',
    params: RequestParams['thread/read'],
    parse: (value: unknown) => Result,
  ): Promise<Result>
  handlesWorkerMessage: (message: unknown) => boolean
}

export function createCodexSessionSyncWorkerBridge(
  actor: ActorRefFrom<typeof codexAppServerMachine>,
): SessionSyncWorkerBridge {
  const codexRequest = requestCodexAppServer(actor)
  return {
    handlesWorkerMessage: (message) =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'codex-request',
    install: (worker) => installCodexWorkerBridge(worker, codexRequest),
    start: ({ ready, fail }) =>
      startWhenCodexReady(codexRequest, {
        start: ready,
        fail,
      }),
  }
}

const sourceKindSchema = z.enum(CODEX_THREAD_SOURCE_KINDS)
const requestSchema = z.discriminatedUnion('method', [
  z.strictObject({
    type: z.literal('codex-request'),
    id: z.string().uuid(),
    method: z.literal('model/list'),
    params: z.strictObject({
      cursor: z.string().optional(),
      limit: z.number().int().positive().optional(),
      includeHidden: z.boolean().optional(),
    }),
  }),
  z.strictObject({
    type: z.literal('codex-request'),
    id: z.string().uuid(),
    method: z.literal('thread/list'),
    params: z.strictObject({
      cursor: z.string().optional(),
      limit: z.number().int().positive().optional(),
      sortKey: z.enum(['created_at', 'updated_at', 'recency_at']).optional(),
      sortDirection: z.enum(['asc', 'desc']).optional(),
      sourceKinds: z.array(sourceKindSchema).optional(),
      archived: z.boolean().optional(),
    }),
  }),
  z.strictObject({
    type: z.literal('codex-request'),
    id: z.string().uuid(),
    method: z.literal('thread/read'),
    params: z.strictObject({ threadId: z.string().min(1), includeTurns: z.literal(false) }),
  }),
])
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
  callbacks: {
    start: () => void
    fail: (error: unknown) => void
    timeoutMs?: number
  },
): () => void {
  let cancelled = false
  const timeoutMs = callbacks.timeoutMs ?? 9_000
  const timeout = setTimeout(() => {
    if (cancelled) return
    cancelled = true
    callbacks.fail(new Error('Codex app-server readiness check timed out.'))
  }, timeoutMs)
  timeout.unref()
  void confirmCodexAppServerReady(codexRequest).then(
    () => {
      if (!cancelled) {
        clearTimeout(timeout)
        cancelled = true
        callbacks.start()
      }
    },
    (error: unknown) => {
      if (!cancelled) {
        clearTimeout(timeout)
        cancelled = true
        callbacks.fail(error)
      }
    },
  )
  return () => {
    cancelled = true
    clearTimeout(timeout)
  }
}

export function validateCodexWorkerRequest(value: unknown): CodexWorkerRequest | null {
  const parsed = requestSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function isCodexWorkerRequest(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && 'type' in value && value.type === 'codex-request'
  )
}

function isCodexWorkerResponse(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'codex-response'
  )
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

type CountedRequest = CodexWorkerReadRequest & { invalidMessageCount: () => number }
type BridgeDisposer = (() => void) & { invalidMessageCount: () => number }

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

export function createCodexWorkerRequest(port: BridgePort, timeoutMs = 9_000): CountedRequest {
  const pending = new Map<string, PendingRequest>()
  let invalidMessageCount = 0
  const onMessage = (message: unknown) => {
    if (!isCodexWorkerResponse(message)) return
    const parsed = responseSchema.safeParse(message)
    if (!parsed.success) {
      invalidMessageCount += 1
      console.error('Invalid Codex Session sync bridge response.', {
        count: invalidMessageCount,
        message,
      })
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
  const request = ((method, params, parse) => {
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
  }) as CountedRequest
  request.handlesWorkerMessage = isCodexWorkerResponse
  request.invalidMessageCount = () => invalidMessageCount
  return request
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

export function installCodexWorkerBridge(
  port: BridgePort,
  codexRequest: CodexRequest,
): BridgeDisposer {
  let closed = false
  let invalidMessageCount = 0
  const onMessage = (message: unknown) => {
    if (!isCodexWorkerRequest(message)) return
    const request = validateCodexWorkerRequest(message)
    if (request === null) {
      invalidMessageCount += 1
      console.error('Invalid Codex Session sync worker request.', {
        count: invalidMessageCount,
        message,
      })
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
  const uninstall = (() => {
    closed = true
    port.off('message', onMessage)
  }) as BridgeDisposer
  uninstall.invalidMessageCount = () => invalidMessageCount
  return uninstall
}
