import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'
import { identifierSchema } from '@/shared/validation'
import { sessionAttachmentInputSchema } from './drive/attachments-contract'

export const sessionSetupSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.string().min(1),
})
const commandSchema = z.strictObject({
  commandId: identifierSchema,
  prompt: z.string(),
  attachments: z.array(sessionAttachmentInputSchema).default([]),
  setup: sessionSetupSchema,
})
export const sessionStartInputSchema = commandSchema.extend({
  harness: harnessSchema,
  cwd: z.string().min(1),
})
export const sessionSendInputSchema = commandSchema.extend({ sessionId: identifierSchema })
export const sessionSubmitInputSchema = commandSchema.extend({
  harness: harnessSchema,
  cwd: z.string().min(1),
  sessionId: identifierSchema.nullable(),
})
export const sessionStartedOutputSchema = z.strictObject({ sessionId: identifierSchema })
export const sessionAcceptedOutputSchema = z.strictObject({ sessionId: identifierSchema })
export type SessionStartInput = z.infer<typeof sessionStartInputSchema>
export type SessionSendInput = z.infer<typeof sessionSendInputSchema>
