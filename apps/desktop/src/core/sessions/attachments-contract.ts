// Choosing a path and proving it is still readable at Send time is the same work for every CLI;
// only each CLI's own adapter (agents/<cli>/) turns a readable path into that CLI's wire
// representation of an attachment (#1886).
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionErrorSchema } from './session-error'

// The formats every adapter's own image input variant accepts (Codex's `localImage`, e.g.);
// anything else is a generic file reference. Kept as one classifier so the composer's preview
// (image thumbnail vs. file icon) and the wire representation never disagree (#1845, #1886).
const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|webp)$/i

export function attachmentKindOf(path: string): 'image' | 'file' {
  return IMAGE_EXTENSION.test(path) ? 'image' : 'file'
}

export const sessionAttachmentInputSchema = z.strictObject({
  path: z.string(),
  kind: z.enum(['image', 'file']),
})
export type SessionAttachmentInput = z.infer<typeof sessionAttachmentInputSchema>

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
