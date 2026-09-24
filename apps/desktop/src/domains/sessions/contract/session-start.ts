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
const sessionCommandWithHarnessSchema = commandSchema.extend({ harness: harnessSchema })
const workingDirectorySchema = z.string().min(1)

export const sessionStartInputSchema = sessionCommandWithHarnessSchema.extend({
  projectId: identifierSchema,
  cwd: workingDirectorySchema,
})
export const existingSessionInputSchema = sessionCommandWithHarnessSchema.extend({
  argoId: identifierSchema,
  nativeId: z.string().min(1),
  projectId: identifierSchema.nullable(),
  cwd: workingDirectorySchema.nullable(),
})
export const sessionSendInputSchema = commandSchema.extend({ sessionId: identifierSchema })
export const sessionSubmitInputSchema = sessionCommandWithHarnessSchema
  .extend({
    projectId: identifierSchema.nullable(),
    cwd: workingDirectorySchema.nullable(),
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
    if (input.sessionId === null && input.cwd === null)
      context.addIssue({
        code: 'custom',
        path: ['cwd'],
        message: 'A new Session requires a working directory.',
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
