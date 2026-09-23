import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import {
  type ClaudeModelCatalog,
  claudeModelsWithEffort,
  claudePermissionModes,
} from './claude-model-catalog'

const claudeSelectedTurnSetupSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.string().min(1),
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
  const mode = claudePermissionModes(catalog).includes('manual')
    ? 'manual'
    : claudePermissionModes(catalog)[0]
  if (mode === undefined) return null
  return { model: model.value, effort, mode }
}

export function claudeTurnSetupSchemaFor(catalog: ClaudeModelCatalog | null) {
  const models = claudeModelsWithEffort(catalog)
  const supported = new Map<string, readonly string[]>(
    models.map(({ value, supportedEffortLevels }) => [value, supportedEffortLevels]),
  )
  const modes = new Set(claudePermissionModes(catalog))
  return z.union([
    z.undefined(),
    claudeSelectedTurnSetupSchema.refine(
      ({ model, effort, mode }) =>
        (supported.get(model)?.includes(effort) ?? false) && modes.has(mode),
      { message: 'Claude does not support the selected setup.', path: ['mode'] },
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
