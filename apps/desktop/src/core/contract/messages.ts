// The message shape every versioned channel shares: version 1, a named type, a request ID, the
// channel's own fields, and errors whose text comes only from the channel's own table.
import { z } from 'zod'
import { identifierSchema, isRecord, requestIdentifier } from '../../boundary'

// The renderer's CSP refuses eval, and zod's `new Function` probe is reported as a violation even
// though zod swallows the throw.
z.config({ jitless: true })

// What counts as an identifier stays boundary.ts's one rule.
export const identifier = identifierSchema

// Extra fields are refused rather than ignored, so a message cannot smuggle a path or a channel
// past the guard.
export function message<const Type extends string, Shape extends z.ZodRawShape>(
  type: Type,
  shape: Shape,
) {
  return z.strictObject({
    version: z.literal(1),
    type: z.literal(type),
    requestId: identifier,
    ...shape,
  })
}

// A schema as the type guard the main-process handlers and the renderer's sender both take.
export function guard<Schema extends z.ZodType>(schema: Schema) {
  return (value: unknown): value is z.infer<Schema> => schema.safeParse(value).success
}

// A numeric version this build does not speak is its own refusal, decided before any storage is
// read; anything else malformed is an invalid request.
export function isOtherVersion(value: unknown): boolean {
  return isRecord(value) && typeof value.version === 'number' && value.version !== 1
}

export type ContractError<Type extends string, Code extends string> = {
  version: 1
  type: Type
  requestId: string | null
  code: Code
  message: string
}

// The error text has to be the table's own string for that code, so a reply cannot carry a
// message the main process assembled from an exception.
export function errorSchema<const Type extends string, Code extends string>(
  type: Type,
  table: Record<Code, string>,
): z.ZodType<ContractError<Type, Code>> {
  const codes = Object.keys(table) as [Code, ...Code[]]
  return z
    .strictObject({
      version: z.literal(1),
      type: z.literal(type),
      requestId: identifier.nullable(),
      code: z.enum(codes),
      message: z.string(),
    })
    .refine((error) => table[error.code] === error.message)
}

// One channel's error constructor, bound to its type and its table.
export function errorFactory<Type extends string, Code extends string>(
  type: Type,
  table: Record<Code, string>,
) {
  return (code: Code, requestId: string | null): ContractError<Type, Code> => ({
    version: 1,
    type,
    requestId,
    code,
    message: table[code],
  })
}

// One routing rule for every channel: a lookup keyed by the action, so an unknown one falls off
// the end as `invalid-request` rather than reaching a handler.
export function createRouter<Context, Reply>(
  handlers: Record<string, (request: unknown, context: Context) => Promise<Reply> | Reply>,
  refuse: (code: 'invalid-request' | 'unsupported-version', requestId: string | null) => Reply,
) {
  return (request: unknown, context: Context): Promise<Reply> | Reply => {
    const requestId = requestIdentifier(request)
    if (isOtherVersion(request)) return refuse('unsupported-version', requestId)
    const action = isRecord(request) ? request.type : undefined
    const handler =
      typeof action === 'string' && Object.hasOwn(handlers, action) && handlers[action]
    return handler ? handler(request, context) : refuse('invalid-request', requestId)
  }
}

// The renderer's whole trust boundary for one channel: an unrecognised reply, or one answering
// another request, becomes `invalid-response` rather than reaching a component.
export function createSender<Failure>(
  invoke: (request: unknown) => Promise<unknown>,
  fail: (code: 'invalid-response' | 'connection-lost', requestId: string | null) => Failure,
) {
  return async <T extends { requestId: string | null }>(
    request: unknown,
    accept: (reply: unknown) => reply is T,
  ): Promise<T | Failure> => {
    const requestId = requestIdentifier(request)
    let reply: unknown
    try {
      reply = await invoke(request)
    } catch {
      return fail('connection-lost', requestId)
    }
    if (!accept(reply) || reply.requestId !== requestId) return fail('invalid-response', requestId)
    return reply
  }
}
