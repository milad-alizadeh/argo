import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

const claudeSelectedTurnSetupSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.string().min(1),
})
export type ClaudeTurnSetup = z.infer<typeof claudeSelectedTurnSetupSchema>
export const claudeTurnSetupSchema = claudeSelectedTurnSetupSchema

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
