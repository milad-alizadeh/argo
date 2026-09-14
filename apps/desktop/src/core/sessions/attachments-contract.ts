// A composer attachment reaches the CLI as text (Claude Code's own `@path` reference syntax), so
// the only main-process work an attachment needs is choosing its path and proving it is still
// readable at Send time; the wire contract for a Turn's prompt is unchanged.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionErrorSchema } from './session-error'

export const sessionChooseAttachmentsRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.attachments.choose'),
  requestId: identifierSchema,
})
export type SessionChooseAttachmentsRequest = z.infer<typeof sessionChooseAttachmentsRequestSchema>

export const sessionAttachmentsChosenSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.attachments.chosen'),
  requestId: identifierSchema,
  // Empty when the chooser was dismissed without a choice.
  paths: z.array(z.string()),
})
export type SessionAttachmentsChosen = z.infer<typeof sessionAttachmentsChosenSchema>

export const sessionStatAttachmentsRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.attachments.stat'),
  requestId: identifierSchema,
  paths: z.array(z.string()),
})
export type SessionStatAttachmentsRequest = z.infer<typeof sessionStatAttachmentsRequestSchema>

export const sessionAttachmentsStattedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.attachments.statted'),
  requestId: identifierSchema,
  files: z.array(z.strictObject({ path: z.string(), readable: z.boolean() })),
})
export type SessionAttachmentsStatted = z.infer<typeof sessionAttachmentsStattedSchema>

export const sessionChooseAttachmentsReplySchema = z.union([
  sessionAttachmentsChosenSchema,
  sessionErrorSchema,
])
export const sessionStatAttachmentsReplySchema = z.union([
  sessionAttachmentsStattedSchema,
  sessionErrorSchema,
])
export type SessionChooseAttachmentsReply = z.infer<typeof sessionChooseAttachmentsReplySchema>
export type SessionStatAttachmentsReply = z.infer<typeof sessionStatAttachmentsReplySchema>
