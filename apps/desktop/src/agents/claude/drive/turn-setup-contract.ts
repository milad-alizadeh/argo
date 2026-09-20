import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

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

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
