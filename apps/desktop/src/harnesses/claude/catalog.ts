import { execFile } from 'node:child_process'
import { type ModelInfo, type Query, query } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  type HarnessInfo,
  harnessInfoSchema,
  invalidCatalogResponse,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'

const effortLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra',
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
  auto: { label: 'Auto', detail: 'Claude handles permission decisions', icon: 'mode-auto' },
  manual: { label: 'Manual', detail: 'Ask before making changes', icon: 'mode-manual' },
  acceptEdits: {
    label: 'Accept edits',
    detail: 'Accept file edits automatically',
    icon: 'mode-accept-edits',
  },
  plan: { label: 'Plan', detail: 'Create a plan before making changes', icon: 'mode-plan' },
  dontAsk: {
    label: "Don't ask",
    detail: 'Deny anything not approved in advance',
    icon: 'mode-dont-ask',
  },
  bypassPermissions: {
    label: 'Bypass',
    detail: 'Run without permission checks',
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
        detail: 'Permission mode reported by Claude Code',
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

export async function readClaudeHarnessInfo(executablePath: string | null): Promise<HarnessInfo> {
  if (executablePath === null) return unavailable('claude')
  try {
    const [models, permissionModes] = await Promise.all([
      readSupportedModels(executablePath),
      readSupportedPermissionModes(executablePath),
    ])
    return claudeHarnessInfo({ data: models, supportedPermissionModes: permissionModes })
  } catch (error) {
    if (error instanceof z.ZodError) return invalidCatalogResponse('claude', error)
    return unavailable('claude')
  }
}

// SDK 0.3.278 initializes with models but does not list supported modes; ask the installed CLI.
function readSupportedPermissionModes(executablePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile(executablePath, ['--help'], { encoding: 'utf8', timeout: 3_000 }, (error, stdout) => {
      if (error !== null) {
        reject(error)
        return
      }
      const modes = permissionModesFromHelp(stdout)
      if (modes.length === 0) {
        reject(new Error('Claude help does not list permission modes.'))
        return
      }
      resolve(modes)
    })
  })
}

export function permissionModesFromHelp(help: string): string[] {
  const section = help.split('--permission-mode <mode>')[1]?.split(/\n {2}--/)[0]
  const choices = section?.match(/\(choices:\s*([^)]*)\)/)?.[1]
  return choices === undefined
    ? []
    : [...choices.matchAll(/"([^"]+)"/g)].flatMap(([, mode]) => (mode ? [mode] : []))
}

async function readSupportedModels(executablePath: string): Promise<readonly ModelInfo[]> {
  const prompt = (async function* () {})()
  const session: Query = query({ prompt, options: { pathToClaudeCodeExecutable: executablePath } })
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const initialized = await Promise.race([
      session.initializationResult(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Claude model discovery timed out.')), 10_000)
      }),
    ])
    return initialized.models
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
    session.close()
  }
}
