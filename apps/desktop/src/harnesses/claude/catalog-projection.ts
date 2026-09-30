import { z } from 'zod'
import {
  type HarnessInfo,
  harnessInfoSchema,
  invalidCatalogResponse,
  unavailable,
} from '@/harnesses/harness-catalog'
import { platformText } from '@/platform/main/i18n'
import { en as copy } from './locales'

const effortLabels: Record<string, string> = {
  low: platformText('harnessCatalog.effort.low'),
  medium: platformText('harnessCatalog.effort.medium'),
  high: platformText('harnessCatalog.effort.high'),
  xhigh: platformText('harnessCatalog.effort.xhigh'),
  max: platformText('harnessCatalog.effort.max'),
  ultra: platformText('harnessCatalog.effort.ultra'),
}
const permissionModePresentation: Record<
  string,
  {
    label: string
    detail: string
    icon:
      | 'mode-auto'
      | 'mode-manual'
      | 'mode-accept-edits'
      | 'mode-plan'
      | 'mode-dont-ask'
      | 'mode-bypass-permissions'
  }
> = {
  auto: {
    label: copy.mode.auto.label,
    detail: copy.mode.auto.detail,
    icon: 'mode-auto',
  },
  manual: {
    label: copy.mode.manual.label,
    detail: copy.mode.manual.detail,
    icon: 'mode-manual',
  },
  acceptEdits: {
    label: copy.mode.acceptEdits.label,
    detail: copy.mode.acceptEdits.detail,
    icon: 'mode-accept-edits',
  },
  plan: {
    label: copy.mode.plan.label,
    detail: copy.mode.plan.detail,
    icon: 'mode-plan',
  },
  dontAsk: {
    label: copy.mode.dontAsk.label,
    detail: copy.mode.dontAsk.detail,
    icon: 'mode-dont-ask',
  },
  bypassPermissions: {
    label: copy.mode.bypassPermissions.label,
    detail: copy.mode.bypassPermissions.detail,
    icon: 'mode-bypass-permissions',
  },
}

const claudeModelSchema = z
  .object({
    value: z.string().min(1),
    resolvedModel: z.string().min(1).optional(),
    displayName: z.string().min(1),
    description: z.string(),
    supportedEffortLevels: z.array(z.string().min(1)).optional(),
    supportsAutoMode: z.boolean().optional(),
  })
  .transform((model) => ({ ...model, supportedEffortLevels: model.supportedEffortLevels ?? [] }))

export const claudeModelCatalogSchema = z.strictObject({
  data: z.array(claudeModelSchema),
  supportedPermissionModes: z.array(z.string().min(1)),
})
export type ClaudeModelCatalog = z.infer<typeof claudeModelCatalogSchema>

function claudeModelChoice(
  model: ClaudeModelCatalog['data'][number],
  permissionModes: string[],
  defaultEffort: string,
) {
  return {
    value: model.value,
    label: model.displayName,
    defaultEffort: model.supportedEffortLevels.includes('medium')
      ? 'medium'
      : (model.supportedEffortLevels[0] ?? defaultEffort),
    efforts: model.supportedEffortLevels,
    detail: model.description || undefined,
    readings: {
      exact: [model.value, ...(model.resolvedModel === undefined ? [] : [model.resolvedModel])],
      prefixes: model.resolvedModel === undefined ? [] : [`claude-${model.value}-`],
    },
    supportedModes: permissionModes.filter(
      (mode) => mode !== 'auto' || model.supportsAutoMode === true,
    ),
  }
}

export function claudeHarnessInfo(response: unknown): HarnessInfo {
  if (response === null) return unavailable('claude')
  const parsed = claudeModelCatalogSchema.safeParse(response)
  if (!parsed.success) return invalidCatalogResponse('claude', parsed.error)
  const catalog = parsed.data
  const models = catalog.data.filter((model) => model.supportedEffortLevels.length > 0)
  const defaultModel = models.find(({ value }) => value === 'opus') ?? models[0]
  const permissionModes = catalog.supportedPermissionModes
  if (defaultModel === undefined || permissionModes.length === 0) return unavailable('claude')
  const defaultEffort = defaultModel.supportedEffortLevels.includes('medium')
    ? 'medium'
    : defaultModel.supportedEffortLevels[0]
  if (defaultEffort === undefined) return unavailable('claude')
  const usableModels = models.filter((model) =>
    permissionModes.some((mode) => mode !== 'auto' || model.supportsAutoMode === true),
  )
  const openingModel =
    usableModels.find(({ value }) => value === defaultModel.value) ?? usableModels[0]
  if (openingModel === undefined) return unavailable('claude')
  const openingModes = permissionModes.filter(
    (mode) => mode !== 'auto' || openingModel.supportsAutoMode === true,
  )
  const openingMode = openingModes.includes('manual') ? 'manual' : openingModes[0]
  if (openingMode === undefined) return unavailable('claude')
  return harnessInfoSchema.parse({
    harness: 'claude',
    availability: 'available',
    agent: 'Claude',
    label: 'Claude Code',
    defaultModelId: openingModel.value,
    modes: permissionModes.map((value) => ({
      value,
      ...(permissionModePresentation[value] ?? {
        label: value,
        detail: copy.mode.unknownModeDetail,
        icon: 'mode-manual' as const,
      }),
      readings: { exact: value === 'manual' ? [value, 'default'] : [value], prefixes: [] },
    })),
    models: usableModels.map((model) => claudeModelChoice(model, permissionModes, defaultEffort)),
    efforts: [...new Set(usableModels.flatMap((model) => model.supportedEffortLevels))].map(
      (value) => ({
        value,
        label: effortLabels[value] ?? value,
        readings: { exact: [value], prefixes: [] },
      }),
    ),
    opening: {
      model: openingModel.value,
      effort: openingModel.supportedEffortLevels.includes('medium')
        ? 'medium'
        : openingModel.supportedEffortLevels[0],
      mode: openingMode,
    },
  })
}
