import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import {
  CLAUDE_EFFORTS,
  type ClaudeModelCatalog,
  claudeModelsWithEffort,
} from './claude-model-catalog'

export { CLAUDE_EFFORTS } from './claude-model-catalog'

export const CLAUDE_FALLBACK_SETUP = { model: 'sonnet', effort: 'medium' } as const
export const CLAUDE_MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const

export const claudeTurnSetupSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.enum(CLAUDE_EFFORTS),
  mode: z.enum(CLAUDE_MODES),
})
export type ClaudeTurnSetup = z.infer<typeof claudeTurnSetupSchema>

export function claudeTurnSetupSchemaFor(catalog: ClaudeModelCatalog | null) {
  const models = claudeModelsWithEffort(catalog)
  const supported = new Map<string, readonly string[]>(
    (
      (models.length > 0 ? models : null) ?? [
        {
          value: CLAUDE_FALLBACK_SETUP.model,
          supportedEffortLevels: [CLAUDE_FALLBACK_SETUP.effort],
        },
      ]
    ).map(({ value, supportedEffortLevels }) => [value, supportedEffortLevels]),
  )
  return claudeTurnSetupSchema.refine(
    ({ model, effort }) => supported.get(model)?.includes(effort) ?? false,
    { message: 'The selected Claude model does not support that effort.', path: ['effort'] },
  )
}

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
