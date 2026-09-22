import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import type { SessionCommand } from './session-command-contract'
import {
  type SessionIdentity,
  sessionIdentitySchema,
  sessionPostureSchema,
  sourceHealthSchema,
  workspaceReferenceSchema,
} from './session-contract'

const turnStatusSchema = z.enum(['running', 'completed', 'interrupted', 'failed'])
export type TurnStatus = z.infer<typeof turnStatusSchema>

const turnSchema = z.strictObject({
  id: identifierSchema,
  status: turnStatusSchema,
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
})
export type Turn = z.infer<typeof turnSchema>

const messageRoleSchema = z.enum(['user', 'agent'])
export type MessageRole = z.infer<typeof messageRoleSchema>

const messageSchema = z.strictObject({
  id: identifierSchema,
  turnId: identifierSchema,
  role: messageRoleSchema,
  text: z.string(),
})
export type Message = z.infer<typeof messageSchema>

const toolCallStatusSchema = z.enum(['running', 'completed', 'failed'])
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>

const toolCallSchema = z.strictObject({
  id: identifierSchema,
  turnId: identifierSchema,
  name: z.string().min(1),
  status: toolCallStatusSchema,
})
export type ToolCall = z.infer<typeof toolCallSchema>

const approvalSchema = z.strictObject({
  id: identifierSchema,
  turnId: identifierSchema,
  toolCallId: identifierSchema.nullable(),
  summary: z.string().min(1),
})
export type Approval = z.infer<typeof approvalSchema>

const questionSchema = z.strictObject({
  id: identifierSchema,
  turnId: identifierSchema,
  prompt: z.string().min(1),
})
export type Question = z.infer<typeof questionSchema>

const sessionStatusSchema = z.enum(['idle', 'running', 'awaitingApproval', 'awaitingAnswer'])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

const sessionUsageSchema = z.strictObject({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
})
export type SessionUsage = z.infer<typeof sessionUsageSchema>

export const sessionProjectionSchema = z.strictObject({
  session: sessionIdentitySchema,
  posture: sessionPostureSchema,
  sourceHealth: sourceHealthSchema,
  revision: z.number().int().nonnegative(),
  workspace: workspaceReferenceSchema.nullable(),
  status: sessionStatusSchema,
  title: z.string().nullable(),
  turns: z.array(turnSchema),
  messages: z.array(messageSchema),
  toolCalls: z.array(toolCallSchema),
  pendingApprovals: z.array(approvalSchema),
  pendingQuestions: z.array(questionSchema),
  usage: sessionUsageSchema,
})
export type SessionProjection = z.infer<typeof sessionProjectionSchema>

// Distinguishes whether a command definitely landed from whether it definitely didn't, so a
// composer can clear its draft only on acceptance, restore it only on definite rejection, and
// never resend on its own when the outcome is unknown (a dropped channel mid-request).
export const sessionCommandOutcomeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('accepted'), projection: sessionProjectionSchema }),
  z.strictObject({ kind: z.literal('rejected'), reason: z.string().min(1) }),
  z.strictObject({ kind: z.literal('uncertain') }),
])
export type SessionCommandOutcome = z.infer<typeof sessionCommandOutcomeSchema>

// A Harness owns its vendor integration; shared Session code sees only validated product messages.
// subscribe's onProjection fires from inside the Harness's own invoked-actor boundary (ADR-0047):
// a parsed SessionProjection crosses, never a raw vendor or XState event.
export type SessionAdapter = {
  execute: (command: SessionCommand) => Promise<SessionCommandOutcome>
  subscribe: (
    session: SessionIdentity,
    onProjection: (projection: SessionProjection) => void,
  ) => Unsubscribe
}
export type Unsubscribe = () => void
