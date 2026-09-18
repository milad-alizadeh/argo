type SafeParseResult<T> = { success: true; data: T } | { success: false; error?: unknown }

type SafeParse<T> = { safeParse(value: unknown): SafeParseResult<T> }

export type ReplyEnvelope = { requestId: string | null }

export type Operation<Request, Reply extends ReplyEnvelope> = {
  name: string
  channel: string
  request: SafeParse<Request>
  reply: SafeParse<Reply>
}

export type OperationTable = Record<string, Operation<unknown, ReplyEnvelope>>

export type RequestOf<Operation> = Operation extends import('./operations').Operation<
  infer Request,
  ReplyEnvelope
>
  ? Request
  : never

export type ReplyOf<Operation> = Operation extends import('./operations').Operation<
  unknown,
  infer Reply extends ReplyEnvelope
>
  ? Reply
  : never

export type SharedErrorCode =
  | 'access-denied'
  | 'unsupported-version'
  | 'invalid-request'
  | 'invalid-response'
  | 'connection-lost'

export type MainErrorCode = Extract<
  SharedErrorCode,
  'access-denied' | 'unsupported-version' | 'invalid-request'
>

export type ClientErrorCode = Extract<SharedErrorCode, 'invalid-response' | 'connection-lost'>
