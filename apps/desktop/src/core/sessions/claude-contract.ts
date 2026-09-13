import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const CLAUDE_MODELS = ['fable', 'opus', 'sonnet', 'haiku'] as const
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export const CLAUDE_MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const

export const claudeTurnSetupSchema = z.strictObject({
  model: z.enum(CLAUDE_MODELS),
  effort: z.enum(CLAUDE_EFFORTS),
  mode: z.enum(CLAUDE_MODES),
})
export type ClaudeTurnSetup = z.infer<typeof claudeTurnSetupSchema>

export const claudeSessionStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.start'),
  requestId: identifierSchema,
  cwd: z.string().min(1),
  prompt: z.string().refine((value) => value.trim().length > 0),
  setup: claudeTurnSetupSchema,
})
export type ClaudeSessionStartRequest = z.infer<typeof claudeSessionStartRequestSchema>

export const claudeSessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionStarted = z.infer<typeof claudeSessionStartedSchema>

export const claudeSessionSendRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.send'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  prompt: z.string().refine((value) => value.trim().length > 0),
  setup: claudeTurnSetupSchema,
})
export type ClaudeSessionSendRequest = z.infer<typeof claudeSessionSendRequestSchema>

export const claudeSessionInterruptRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.interrupt'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionInterruptRequest = z.infer<typeof claudeSessionInterruptRequestSchema>

export const claudeSessionAcceptedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.accepted'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionAccepted = z.infer<typeof claudeSessionAcceptedSchema>

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
export const claudeSessionPermissionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionPermissionRequest = z.infer<typeof claudeSessionPermissionRequestSchema>
export const claudeSessionPermissionReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permission: claudePermissionSchema.nullable(),
})
export type ClaudeSessionPermissionRead = z.infer<typeof claudeSessionPermissionReadSchema>
export const claudeSessionPermissionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permissionId: identifierSchema,
  decision: z.enum(['allow', 'deny']),
})
export type ClaudeSessionPermissionDecisionRequest = z.infer<
  typeof claudeSessionPermissionDecisionRequestSchema
>
