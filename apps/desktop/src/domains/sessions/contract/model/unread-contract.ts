import { z } from 'zod'
import { sessionErrorSchema } from '@/domains/sessions/contract/model/session-error'
import { identifierSchema } from '@/shared/validation'

export const sessionUnreadFocusRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.unread.focus'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionUnreadFocusRequest = z.infer<typeof sessionUnreadFocusRequestSchema>

export const sessionUnreadFocusedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.unread.focused'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionUnreadFocused = z.infer<typeof sessionUnreadFocusedSchema>

export const sessionUnreadFocusReplySchema = z.union([
  sessionUnreadFocusedSchema,
  sessionErrorSchema,
])
export type SessionUnreadFocusReply = z.infer<typeof sessionUnreadFocusReplySchema>
