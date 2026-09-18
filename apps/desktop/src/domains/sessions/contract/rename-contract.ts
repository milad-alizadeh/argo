import { z } from 'zod'
import { identifierSchema } from '@/boundary'
import { sessionErrorSchema } from './session-error'

function safeName(name: string): boolean {
  return [...name].every((character) => {
    const code = character.codePointAt(0) ?? 0
    return code > 31 && (code < 127 || code > 159)
  })
}

export const sessionRenameRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.rename'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  name: z.string().trim().min(1).refine(safeName),
})
export type SessionRenameRequest = z.infer<typeof sessionRenameRequestSchema>

export const sessionRenamedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.renamed'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  title: z.string().min(1),
})
export type SessionRenamed = z.infer<typeof sessionRenamedSchema>

export const sessionRenameReplySchema = z.union([sessionRenamedSchema, sessionErrorSchema])
export type SessionRenameReply = z.infer<typeof sessionRenameReplySchema>
