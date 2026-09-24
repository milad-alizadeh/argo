import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'

export const sessionFeedInputSchema = z.strictObject({ sessionId: identifierSchema })

export const sessionHistoryEntrySchema = z.strictObject({
  sourceId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system']),
  text: z.string(),
})

export const sessionAvailabilitySchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('available'), reason: z.string().nullable() }),
  z.strictObject({ state: z.literal('unavailable'), reason: z.string().min(1) }),
  z.strictObject({ state: z.literal('unknown'), reason: z.string().min(1) }),
])

export const sessionFeedOutputSchema = z.discriminatedUnion('result', [
  z.strictObject({
    result: z.literal('history'),
    harness: harnessSchema,
    availability: sessionAvailabilitySchema,
    entries: z.array(sessionHistoryEntrySchema),
    live: z.boolean(),
  }),
  z.strictObject({
    result: z.literal('empty'),
    harness: harnessSchema,
    availability: sessionAvailabilitySchema,
    live: z.boolean(),
  }),
])

export type SessionFeedOutput = z.infer<typeof sessionFeedOutputSchema>
export type SessionAvailability = z.infer<typeof sessionAvailabilitySchema>
export type SessionHistoryEntry = z.infer<typeof sessionHistoryEntrySchema>
