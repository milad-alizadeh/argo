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
  projectId: identifierSchema,
  cwd: z.string().min(1),
})
export const existingSessionInputSchema = commandSchema.extend({
  argoId: identifierSchema,
  harness: harnessSchema,
  nativeId: z.string().min(1),
  projectId: identifierSchema.nullable(),
  cwd: z.string().min(1),
})
export const sessionSendInputSchema = commandSchema.extend({ sessionId: identifierSchema })
export const sessionSubmitInputSchema = commandSchema
  .extend({
    harness: harnessSchema,
    projectId: identifierSchema.nullable(),
    cwd: z.string().min(1),
    sessionId: identifierSchema.nullable(),
    pendingId: z.string().min(1).nullable(),
  })
  .superRefine((input, context) => {
    if (input.sessionId === null && input.pendingId === null)
      context.addIssue({
        code: 'custom',
        path: ['pendingId'],
        message: 'A new Session requires its pending identity.',
      })
    if (input.sessionId === null && input.projectId === null)
      context.addIssue({
        code: 'custom',
        path: ['projectId'],
        message: 'A new Session requires a Project.',
      })
    if (input.sessionId !== null && input.pendingId !== null)
      context.addIssue({
        code: 'custom',
        path: ['pendingId'],
        message: 'An existing Session cannot use a pending identity.',
      })
    if (input.harness === 'claude' && input.attachments.length > 0)
      context.addIssue({
        code: 'custom',
        path: ['attachments'],
        message: 'Claude Session attachments are not supported.',
      })
  })
export const sessionAcceptedOutputSchema = z.strictObject({ sessionId: identifierSchema })
export type SessionStartInput = z.infer<typeof sessionStartInputSchema>
export type ExistingSessionInput = z.infer<typeof existingSessionInputSchema>
export type SessionMachineInput = SessionStartInput | ExistingSessionInput
export type SessionSendInput = z.infer<typeof sessionSendInputSchema>
export type SessionSubmitInput = z.infer<typeof sessionSubmitInputSchema>
