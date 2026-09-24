import { z } from 'zod'

export const TRPC_CHANNEL = 'argo:trpc'

export const trpcRequestSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  path: z.string().min(1),
  type: z.enum(['query', 'mutation']),
  input: z.unknown(),
})

export type TrpcRequest = z.infer<typeof trpcRequestSchema>
