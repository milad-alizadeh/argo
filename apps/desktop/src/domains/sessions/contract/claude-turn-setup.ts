import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import {
  CLAUDE_EFFORTS,
  type ClaudeModelCatalog,
  claudeModelsWithEffort,
} from './claude-model-catalog'

export { CLAUDE_EFFORTS } from './claude-model-catalog'

export const CLAUDE_MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const

const claudeSelectedTurnSetupSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.enum(CLAUDE_EFFORTS),
  mode: z.enum(CLAUDE_MODES),
})
export type ClaudeTurnSetup = z.infer<typeof claudeSelectedTurnSetupSchema>
export const claudeTurnSetupSchema = claudeSelectedTurnSetupSchema

export function claudeOpeningSetupFor(catalog: ClaudeModelCatalog): ClaudeTurnSetup | null {
  const models = claudeModelsWithEffort(catalog)
  const model = models.find(({ value }) => value === 'opus') ?? models[0]
  const effort = model?.supportedEffortLevels.includes('medium')
    ? 'medium'
    : model?.supportedEffortLevels[0]
  if (model === undefined || effort === undefined) return null
  return { model: model.value, effort, mode: 'manual' }
}

export function claudeTurnSetupSchemaFor(catalog: ClaudeModelCatalog | null) {
  const models = claudeModelsWithEffort(catalog)
  const supported = new Map<string, readonly string[]>(
    models.map(({ value, supportedEffortLevels }) => [value, supportedEffortLevels]),
  )
  return z.union([
    z.undefined(),
    claudeSelectedTurnSetupSchema.refine(
      ({ model, effort }) => supported.get(model)?.includes(effort) ?? false,
      { message: 'The selected Claude model does not support that effort.', path: ['effort'] },
    ),
  ])
}

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
