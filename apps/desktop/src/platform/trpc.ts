import { z } from 'zod'

export const TRPC_CHANNEL = 'argo:trpc'

const trpcRequestFields = {
  id: z.number().int().nonnegative(),
  path: z.string().min(1),
  input: z.unknown(),
}

export const trpcRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...trpcRequestFields, type: z.literal('query') }),
  z.strictObject({ ...trpcRequestFields, type: z.literal('mutation') }),
  z.strictObject({ ...trpcRequestFields, type: z.literal('subscription') }),
])

export type TrpcRequest = z.infer<typeof trpcRequestSchema>

export const trpcSubscriptionStopSchema = z.strictObject({
  id: z.number().int().nonnegative(),
  type: z.literal('subscriptionStop'),
})

export type TrpcSubscriptionStop = z.infer<typeof trpcSubscriptionStopSchema>

export const trpcSubscriptionMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    id: z.number().int().nonnegative(),
    type: z.literal('data'),
    result: z.strictObject({ data: z.unknown() }),
  }),
  z.strictObject({
    id: z.number().int().nonnegative(),
    type: z.literal('error'),
    error: z.unknown(),
  }),
  z.strictObject({
    id: z.number().int().nonnegative(),
    type: z.literal('complete'),
  }),
])

export type TrpcSubscriptionMessage = z.infer<typeof trpcSubscriptionMessageSchema>
