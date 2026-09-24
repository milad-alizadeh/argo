import { z } from 'zod'
import {
  type HarnessInfo,
  harnessInfoSchema,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'
import type { CodexRequest } from './app-server/codex-app-server-machine'

function effortLabel(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const codexModelEffortSchema = z.object({
  reasoningEffort: z.string().min(1),
  description: z.string().nullable().optional(),
})
export const codexModelSchema = z
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
export const codexModelCatalogSchema = z.object({
  data: z.array(codexModelSchema),
  nextCursor: z.string().nullable().optional(),
})
export type CodexModelCatalog = z.infer<typeof codexModelCatalogSchema>

const SANDBOX_MODES = [
  {
    value: 'read-only',
    label: 'Ask first',
    detail: 'Read-only work asks before any change',
    icon: 'mode-manual',
  },
  {
    value: 'workspace-write',
    label: 'Approve safely',
    detail: 'Work in this project, asking at the boundary',
    icon: 'mode-approve-safely',
  },
  {
    value: 'danger-full-access',
    label: 'Full access',
    detail: 'Work without permission prompts',
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
      label: effort.description || effortLabel(effort.reasoningEffort),
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
  } catch {
    return unavailable('codex')
  }
}
