import { z } from 'zod'
import type { CodexModelCatalog } from './codex-model-catalog'

export const CODEX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const

const codexSelectedTurnSetupBaseSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.enum(CODEX_MODES),
})
export type CodexTurnSetup = z.infer<typeof codexSelectedTurnSetupBaseSchema>
export const codexTurnSetupSchema = z.union([z.undefined(), codexSelectedTurnSetupBaseSchema])
export const CODEX_OPENING_SETUP: CodexTurnSetup = {
  model: 'gpt-5.6-luna',
  effort: 'low',
  mode: 'workspace-write',
}

export function codexTurnSetupSchemaFor(catalog: CodexModelCatalog | null) {
  const efforts = new Map(
    catalog?.data
      .filter(({ hidden }) => !hidden)
      .map(({ model, supportedReasoningEfforts }) => [
        model,
        supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
      ]) ?? [],
  )
  return z.union([
    z.undefined(),
    codexSelectedTurnSetupBaseSchema.refine(
      ({ model, effort }) => efforts.get(model)?.includes(effort) ?? false,
      {
        message: 'The selected Codex model does not support that effort.',
        path: ['effort'],
      },
    ),
  ])
}

export function codexOpeningSetupFor(catalog: CodexModelCatalog): CodexTurnSetup | null {
  const model =
    catalog?.data.find(({ isDefault, hidden }) => isDefault && !hidden) ??
    catalog?.data.find(({ hidden }) => !hidden)
  const effort = model?.supportedReasoningEfforts.some(
    ({ reasoningEffort }) => reasoningEffort === model.defaultReasoningEffort,
  )
    ? model.defaultReasoningEffort
    : model?.supportedReasoningEfforts[0]?.reasoningEffort
  if (model === undefined || effort === undefined) return null
  return { model: model.model, effort, mode: 'workspace-write' }
}

export function codexTurnSettings(setup: CodexTurnSetup) {
  const mode = {
    'read-only': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'readOnly' } },
    'workspace-write': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'workspaceWrite' } },
    'danger-full-access': { approvalPolicy: 'never', sandboxPolicy: { type: 'dangerFullAccess' } },
  } as const
  return { model: setup.model, effort: setup.effort, ...mode[setup.mode] }
}
