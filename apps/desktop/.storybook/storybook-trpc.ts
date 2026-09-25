type TrpcRequest = {
  id: number
  path: string
  input: unknown
  type: 'query' | 'mutation' | 'subscription'
}

type TrpcReply =
  | { id: number; result: { data: unknown } }
  | { id: number; error: { message: string } }

export type StorybookProcedureHandlers = Partial<
  Record<string, (input: never) => unknown | Promise<unknown>>
>

export function createStorybookTrpcHost(
  handlers: () => StorybookProcedureHandlers,
): (request: TrpcRequest) => Promise<TrpcReply> {
  return async (request) => {
    const handler = handlers()[request.path]
    if (handler === undefined) {
      return {
        id: request.id,
        error: { message: `No Storybook tRPC handler for ${request.path}.` },
      }
    }
    try {
      return { id: request.id, result: { data: await handler(request.input as never) } }
    } catch (error) {
      return {
        id: request.id,
        error: {
          message: error instanceof Error ? error.message : 'Storybook tRPC handler failed.',
        },
      }
    }
  }
}
