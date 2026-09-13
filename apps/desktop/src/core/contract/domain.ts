// One IPC contract module for the whole channel of every domain (ADR-0039). A domain gives it an
// operation table, one handler per operation, and its own error factory; the module does the rest
// the same way for every domain: trust check, version check, request parse, reply parse, request
// id check. Nothing here decides what a domain's operations are or what its errors mean.
import type { BrowserWindow } from 'electron'
import { requestIdentifier } from '../../boundary'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import { isOtherVersion } from './messages'

type SafeParse<T> = { safeParse(value: unknown): { success: boolean; data?: T } }

export type Operation<Request, Reply> = {
  name: string
  channel: string
  request: SafeParse<Request>
  reply: SafeParse<Reply>
}

export type OperationTable = Record<string, Operation<unknown, unknown>>

type RequestOf<O> = O extends Operation<infer Request, unknown> ? Request : never
type ReplyOf<O> = O extends Operation<unknown, infer Reply> ? Reply : never

export type SharedErrorCode =
  | 'access-denied'
  | 'unsupported-version'
  | 'invalid-request'
  | 'invalid-response'
  | 'connection-lost'

type MainErrorCode = Extract<
  SharedErrorCode,
  'access-denied' | 'unsupported-version' | 'invalid-request'
>
type ClientErrorCode = Extract<SharedErrorCode, 'invalid-response' | 'connection-lost'>

export function registerDomainHandlers<Operations extends OperationTable, Context>(config: {
  window: BrowserWindow
  rendererURL: string
  operations: Operations
  context: Context
  handlers: {
    [Key in keyof Operations]: (
      request: RequestOf<Operations[Key]>,
      context: Context,
    ) => Promise<ReplyOf<Operations[Key]>> | ReplyOf<Operations[Key]>
  }
  error: (code: MainErrorCode, requestId: string | null) => unknown
}): void {
  const { window, rendererURL, operations, context, handlers, error } = config
  for (const key of Object.keys(operations) as Array<keyof Operations>) {
    const operation = operations[key] as Operations[typeof key]
    window.webContents.ipc.handle(operation.channel, (event, request: unknown) => {
      if (!isTrustedRendererFrame(event, window, rendererURL)) {
        return error('access-denied', requestIdentifier(request))
      }
      if (isOtherVersion(request)) {
        return error('unsupported-version', requestIdentifier(request))
      }
      const parsed = operation.request.safeParse(request)
      if (!parsed.success) return error('invalid-request', requestIdentifier(request))
      return handlers[key](parsed.data as RequestOf<Operations[typeof key]>, context)
    })
  }
}

type EnvelopeFields<Request> = Omit<Request, 'version' | 'type' | 'requestId'>

export function createDomainClient<Operations extends OperationTable>(
  operations: Operations,
  invoke: (channel: string, request: unknown) => Promise<unknown>,
  error: (code: ClientErrorCode, requestId: string | null) => unknown,
): {
  [Key in keyof Operations]: (
    fields?: EnvelopeFields<RequestOf<Operations[Key]>>,
  ) => Promise<ReplyOf<Operations[Key]>>
} {
  const client = {} as {
    [Key in keyof Operations]: (
      fields?: EnvelopeFields<RequestOf<Operations[Key]>>,
    ) => Promise<ReplyOf<Operations[Key]>>
  }
  for (const key of Object.keys(operations) as Array<keyof Operations>) {
    const operation = operations[key] as Operations[typeof key]
    client[key] = (async (fields: Record<string, unknown> = {}) => {
      const requestId = crypto.randomUUID()
      const request = { ...fields, version: 1, type: operation.name, requestId }
      let reply: unknown
      try {
        reply = await invoke(operation.channel, request)
      } catch {
        return error('connection-lost', requestId)
      }
      const parsed = operation.reply.safeParse(reply)
      if (!parsed.success) return error('invalid-response', requestId)
      const data = parsed.data as { requestId?: string | null }
      if (data.requestId !== requestId) return error('invalid-response', requestId)
      return parsed.data
    }) as (typeof client)[typeof key]
  }
  return client
}
