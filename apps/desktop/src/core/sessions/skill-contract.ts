import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionErrorSchema } from './session-error'

// A skill a prompt mentions, read by the absolute path the CLI wrote into the prompt.
export const sessionSkillRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.skill.read'),
  requestId: identifierSchema,
  path: z.string().min(1),
})
export type SessionSkillRequest = z.infer<typeof sessionSkillRequestSchema>

export const sessionSkillReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.skill.read'),
  requestId: identifierSchema,
  content: z.string().nullable(),
})
export type SessionSkillRead = z.infer<typeof sessionSkillReadSchema>

export const sessionSkillReplySchema = z.union([sessionSkillReadSchema, sessionErrorSchema])
export type SessionSkillReply = z.infer<typeof sessionSkillReplySchema>
