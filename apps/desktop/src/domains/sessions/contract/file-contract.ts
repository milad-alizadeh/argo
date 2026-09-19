import { z } from 'zod'
import { sessionErrorSchema } from '@/domains/sessions/contract/session-error'
import { identifierSchema } from '@/shared/validation'

export const sessionFileRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.file.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  path: z.string().min(1),
})
export type SessionFileRequest = z.infer<typeof sessionFileRequestSchema>

export const sessionFileReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.file.read'),
  requestId: identifierSchema,
  content: z.string().nullable(),
})
export type SessionFileRead = z.infer<typeof sessionFileReadSchema>

export const sessionFileReplySchema = z.union([sessionFileReadSchema, sessionErrorSchema])
export type SessionFileReply = z.infer<typeof sessionFileReplySchema>
