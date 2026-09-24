import { z } from 'zod'
import { sessionProjectionSchema } from '@/domains/sessions/next/contract/session-projection-contract'

export const MANAGED_SESSION_PROJECTION_CHANNEL = 'argo:managed-session:projection'

export const managedSessionProjectionEventSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.projection'),
  requestId: z.literal('subscription'),
  projection: sessionProjectionSchema,
})
