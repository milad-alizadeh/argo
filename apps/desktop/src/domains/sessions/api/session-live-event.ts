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

export const SESSION_STATUSES = [
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
] as const
export const sessionLiveStatusSchema = z.enum(SESSION_STATUSES)
type SessionStatus = z.infer<typeof sessionLiveStatusSchema>

// The statuses of a Session with a Turn under way.
export const WORKING_SESSION_STATUSES = [
  'starting',
  'running',
  'permission',
  'asking',
] as const satisfies readonly SessionStatus[]
const workingStatuses = new Set<SessionStatus>(WORKING_SESSION_STATUSES)
export const isWorkingStatus = (status: SessionStatus) => workingStatuses.has(status)

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
