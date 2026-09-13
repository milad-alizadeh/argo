import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const codexSessionStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.codex.start'),
  requestId: identifierSchema,
  cwd: z.string().min(1),
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type CodexSessionStartRequest = z.infer<typeof codexSessionStartRequestSchema>

export const codexSessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.codex.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type CodexSessionStarted = z.infer<typeof codexSessionStartedSchema>

export const codexSessionSendRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.codex.send'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type CodexSessionSendRequest = z.infer<typeof codexSessionSendRequestSchema>

export const codexSessionInterruptRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.codex.interrupt'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type CodexSessionInterruptRequest = z.infer<typeof codexSessionInterruptRequestSchema>

export const codexSessionAcceptedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.codex.accepted'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type CodexSessionAccepted = z.infer<typeof codexSessionAcceptedSchema>
