import { execFile } from 'node:child_process'
import { type ModelInfo, type Query, query } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  type HarnessInfo,
  harnessInfoSchema,
  invalidCatalogResponse,
  unavailable,
} from '@/harnesses/catalog/harness-catalog-machine'
import { platformText } from '@/platform/main/i18n'

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
    label: platformText('harnessCatalog.claudeMode.auto.label'),
    detail: platformText('harnessCatalog.claudeMode.auto.detail'),
    icon: 'mode-auto',
  },
  manual: {
    label: platformText('harnessCatalog.claudeMode.manual.label'),
    detail: platformText('harnessCatalog.claudeMode.manual.detail'),
    icon: 'mode-manual',
  },
  acceptEdits: {
    label: platformText('harnessCatalog.claudeMode.acceptEdits.label'),
    detail: platformText('harnessCatalog.claudeMode.acceptEdits.detail'),
    icon: 'mode-accept-edits',
  },
  plan: {
    label: platformText('harnessCatalog.claudeMode.plan.label'),
    detail: platformText('harnessCatalog.claudeMode.plan.detail'),
    icon: 'mode-plan',
  },
  dontAsk: {
    label: platformText('harnessCatalog.claudeMode.dontAsk.label'),
    detail: platformText('harnessCatalog.claudeMode.dontAsk.detail'),
    icon: 'mode-dont-ask',
  },
  bypassPermissions: {
    label: platformText('harnessCatalog.claudeMode.bypassPermissions.label'),
    detail: platformText('harnessCatalog.claudeMode.bypassPermissions.detail'),
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
        detail: platformText('harnessCatalog.claudeMode.unknownModeDetail'),
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
    if (error instanceof InvalidPermissionModesError)
      return {
        harness: 'claude',
        availability: 'unavailable',
        reason: 'invalid-response',
        detail: error.message,
      }
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
        reject(new InvalidPermissionModesError())
        return
      }
      resolve(modes)
    })
  })
}

export class InvalidPermissionModesError extends Error {
  constructor() {
    super('Claude help does not list permission modes.')
  }
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
