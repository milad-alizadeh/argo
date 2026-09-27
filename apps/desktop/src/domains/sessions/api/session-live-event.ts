import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { feedContentSchema } from './feed-content'
import { questionSchema } from './questions'

const identity = {
  commandId: identifierSchema.nullable(),
  turnId: identifierSchema.nullable(),
  vendorEventId: identifierSchema.nullable(),
}

export const sessionLiveEventBodySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('content'), ...identity, content: feedContentSchema }),
  z.strictObject({
    type: z.literal('status'),
    ...identity,
    status: z.enum([
      'starting',
      'running',
      'permission',
      'asking',
      'idle',
      'stopped',
      'ended',
      'unknown',
    ]),
  }),
  z.strictObject({
    type: z.literal('permission'),
    ...identity,
    requestId: identifierSchema,
    description: z.string(),
  }),
  z.strictObject({
    type: z.literal('question'),
    ...identity,
    requestId: identifierSchema,
    questions: z.array(questionSchema).min(1),
    answer: z.string().nullable(),
  }),
  z.strictObject({ type: z.literal('failure'), ...identity, detail: z.string().min(1) }),
])

export const sessionLiveEventSchema = z.intersection(
  z.strictObject({ sessionId: identifierSchema, sequence: z.number().int().positive() }),
  sessionLiveEventBodySchema,
)

export const sessionLiveUpdateSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ready'),
    live: z.boolean(),
    cursor: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('event'), event: sessionLiveEventSchema }),
  z.strictObject({ type: z.literal('expired'), cursor: z.number().int().nonnegative() }),
])

export type SessionLiveEventBody = z.infer<typeof sessionLiveEventBodySchema>
export type SessionLiveEvent = z.infer<typeof sessionLiveEventSchema>
export type SessionLiveUpdate = z.infer<typeof sessionLiveUpdateSchema>
