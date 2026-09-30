// The tRPC wire between the renderer and the main process, carried over the preload bridge.
import { z } from 'zod'

export const TRPC_CHANNEL = 'argo:trpc'

export const trpcRequestSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  path: z.string().min(1),
  input: z.unknown(),
  type: z.enum(['query', 'mutation', 'subscription']),
})

export type TrpcRequest = z.infer<typeof trpcRequestSchema>

export type TrpcSubscriptionMessage =
  | { id: number; type: 'data'; result: { data: unknown } }
  | { id: number; type: 'error'; error: unknown }
  | { id: number; type: 'complete' }
