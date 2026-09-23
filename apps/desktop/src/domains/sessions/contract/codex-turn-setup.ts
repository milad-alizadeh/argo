import { z } from 'zod'
import type { CodexModelCatalog } from './codex-model-catalog'

export const CODEX_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.3-codex-spark',
] as const
export const CODEX_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const
export const CODEX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const

const effortsByModel: Record<string, readonly string[]> = {
  'gpt-5.6-sol': CODEX_EFFORTS,
  'gpt-5.6-terra': CODEX_EFFORTS,
  'gpt-5.6-luna': ['low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.5': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.3-codex-spark': ['low', 'medium', 'high', 'xhigh'],
}

const codexSelectedTurnSetupBaseSchema = z.strictObject({
  model: z.string().min(1),
  effort: z.string().min(1),
  mode: z.enum(CODEX_MODES),
})
export type CodexTurnSetup = z.infer<typeof codexSelectedTurnSetupBaseSchema>

export function codexTurnSetupSchemaFor(catalog: CodexModelCatalog | null) {
  const efforts = new Map<string, readonly string[]>(
    catalog === null
      ? Object.entries(effortsByModel)
      : catalog.data
          .filter(({ hidden }) => !hidden)
          .map(({ model, supportedReasoningEfforts }) => [
            model,
            supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
          ]),
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

export const codexTurnSetupSchema = codexTurnSetupSchemaFor(null)
export const CODEX_OPENING_SETUP: CodexTurnSetup = {
  model: 'gpt-5.6-luna',
  effort: 'low',
  mode: 'workspace-write',
}

export function codexOpeningSetupFor(catalog: CodexModelCatalog | null): CodexTurnSetup {
  const model =
    catalog?.data.find(({ isDefault, hidden }) => isDefault && !hidden) ??
    catalog?.data.find(({ hidden }) => !hidden)
  const effort = model?.supportedReasoningEfforts.some(
    ({ reasoningEffort }) => reasoningEffort === model.defaultReasoningEffort,
  )
    ? model.defaultReasoningEffort
    : model?.supportedReasoningEfforts[0]?.reasoningEffort
  if (model === undefined || effort === undefined) return CODEX_OPENING_SETUP
  return { model: model.model, effort, mode: 'workspace-write' }
}

export function codexEfforts(model: CodexTurnSetup['model']) {
  return effortsByModel[model]
}

export function codexTurnSettings(setup: CodexTurnSetup) {
  const mode = {
    'read-only': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'readOnly' } },
    'workspace-write': { approvalPolicy: 'on-request', sandboxPolicy: { type: 'workspaceWrite' } },
    'danger-full-access': { approvalPolicy: 'never', sandboxPolicy: { type: 'dangerFullAccess' } },
  } as const
  return { model: setup.model, effort: setup.effort, ...mode[setup.mode] }
}
