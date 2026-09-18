import { z } from 'zod'
import { identifierSchema } from '../../shared/validation'

export const sessionHandoffRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.handoff'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionHandoffRequest = z.infer<typeof sessionHandoffRequestSchema>
