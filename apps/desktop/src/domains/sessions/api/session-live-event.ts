import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { feedContentSchema } from './feed-content'
import { questionSchema } from './questions'

export const SESSION_LIVE_REPLAY_EVENT_LIMIT = 500
export const SESSION_LIVE_REPLAY_BYTE_LIMIT = 2 * 1024 * 1024

const identity = {
  commandId: identifierSchema.nullable(),
  turnId: identifierSchema.nullable(),
  vendorEventId: identifierSchema.nullable(),
}

export const sessionLiveStatusSchema = z.enum([
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
])

export const sessionLiveEventBodySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('content'), ...identity, content: feedContentSchema }),
  z.strictObject({
    type: z.literal('status'),
    ...identity,
    status: sessionLiveStatusSchema,
  }),
  z.strictObject({
    type: z.literal('permission'),
    ...identity,
    requestId: identifierSchema,
    description: z.string(),
    decision: z.enum(['allow', 'allowForSession', 'deny', 'cancel']).nullable(),
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

export type SessionLiveEventBody = z.infer<typeof sessionLiveEventBodySchema>
export type SessionLiveEvent = z.infer<typeof sessionLiveEventSchema>
