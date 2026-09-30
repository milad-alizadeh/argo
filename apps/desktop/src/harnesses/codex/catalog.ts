import { z } from 'zod'
import { effortLabel } from '@/harnesses/effort-labels'
import {
  type HarnessInfo,
  harnessInfoSchema,
  invalidCatalogResponse,
  unavailable,
} from '@/harnesses/harness-catalog'
import type { CodexRequest } from './app-server'
import { en as copy } from './locales'

const codexModelEffortSchema = z.object({
  reasoningEffort: z.string().min(1),
  description: z.string().nullable().optional(),
})
const codexModelSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string().nullable().optional(),
    defaultReasoningEffort: z.string().min(1),
    isDefault: z.boolean(),
    hidden: z.boolean(),
    supportedReasoningEfforts: z.array(codexModelEffortSchema).min(1),
  })
  .superRefine((model, context) => {
    if (
      !model.supportedReasoningEfforts.some(
        ({ reasoningEffort }) => reasoningEffort === model.defaultReasoningEffort,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Default reasoning effort must be advertised.',
        path: ['defaultReasoningEffort'],
      })
    }
  })
const codexModelCatalogSchema = z.object({
  data: z.array(codexModelSchema),
  nextCursor: z.string().nullable().optional(),
})
export type CodexModelCatalog = z.infer<typeof codexModelCatalogSchema>

const SANDBOX_MODES = [
  {
    value: 'read-only',
    label: copy.mode.readOnly.label,
    detail: copy.mode.readOnly.detail,
    icon: 'mode-manual',
  },
  {
    value: 'workspace-write',
    label: copy.mode.workspaceWrite.label,
    detail: copy.mode.workspaceWrite.detail,
    icon: 'mode-approve-safely',
  },
  {
    value: 'danger-full-access',
    label: copy.mode.fullAccess.label,
    detail: copy.mode.fullAccess.detail,
    icon: 'mode-bypass-permissions',
  },
] as const

function codexModelChoice(model: CodexModelCatalog['data'][number], defaultEffort: string) {
  const efforts = model.supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort)
  return {
    value: model.model,
    label: model.displayName || model.model,
    detail: model.description || undefined,
    defaultEffort: efforts.includes(model.defaultReasoningEffort)
      ? model.defaultReasoningEffort
      : (efforts[0] ?? defaultEffort),
    efforts,
    readings: { exact: [model.model], prefixes: [] },
  }
}

export function codexHarnessInfo(catalog: CodexModelCatalog | null): HarnessInfo {
  const availableModels =
    catalog?.data.filter(
      ({ hidden, supportedReasoningEfforts }) => !hidden && supportedReasoningEfforts.length > 0,
    ) ?? []
  const defaultModel = availableModels.find(({ isDefault }) => isDefault) ?? availableModels[0]
  if (defaultModel === undefined) return unavailable('codex')
  const defaultEffort = defaultModel.supportedReasoningEfforts.some(
    ({ reasoningEffort }) => reasoningEffort === defaultModel.defaultReasoningEffort,
  )
    ? defaultModel.defaultReasoningEffort
    : defaultModel.supportedReasoningEfforts[0]?.reasoningEffort
  if (defaultEffort === undefined) return unavailable('codex')
  return harnessInfoSchema.parse({
    harness: 'codex',
    availability: 'available',
    agent: 'Codex',
    label: 'Codex',
    defaultModelId: defaultModel.model,
    models: availableModels.map((model) => codexModelChoice(model, defaultEffort)),
    efforts: [
      ...new Map(
        availableModels
          .flatMap((model) => model.supportedReasoningEfforts)
          .map((effort) => [effort.reasoningEffort, effort]),
      ).values(),
    ].map((effort) => ({
      value: effort.reasoningEffort,
      label: effortLabel(effort.reasoningEffort),
      readings: { exact: [effort.reasoningEffort], prefixes: [] },
    })),
    modes: SANDBOX_MODES.map((mode) => ({
      ...mode,
      readings: { exact: [mode.value], prefixes: [] },
    })),
    opening: { model: defaultModel.model, effort: defaultEffort, mode: 'workspace-write' },
  })
}

export function readModelCatalog(value: unknown): CodexModelCatalog {
  return codexModelCatalogSchema.parse(value)
}

export async function readCodexHarnessInfo(request: CodexRequest): Promise<HarnessInfo> {
  try {
    const data: CodexModelCatalog['data'] = []
    let cursor: string | undefined
    do {
      const page = await request(
        'model/list',
        { includeHidden: false, limit: 100, ...(cursor === undefined ? {} : { cursor }) },
        readModelCatalog,
      )
      data.push(...page.data)
      cursor = page.nextCursor ?? undefined
    } while (cursor !== undefined)
    return codexHarnessInfo({ data, nextCursor: null })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidCatalogResponse('codex', error)
    return unavailable('codex')
  }
}
