import type { ClientErrorCode, OperationTable, ReplyOf, RequestOf } from './operations'

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
      if (parsed.data.requestId !== requestId) return error('invalid-response', requestId)
      return parsed.data
    }) as (typeof client)[typeof key]
  }
  return client
}
