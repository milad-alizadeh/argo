import { z } from 'zod'
import type { Harness } from '@/harnesses/harness'
import {
  type AvailableHarness,
  type HarnessInfo,
  harnessInfoSchema,
  invalidCatalogResponse,
} from '@/harnesses/harness-catalog'

type ModeIcon = AvailableHarness['modes'][number]['icon']

// Mode names agents commonly report; any other mode draws as the manual one.
const MODE_ICONS: Readonly<Record<string, ModeIcon>> = {
  default: 'mode-manual',
  acceptEdits: 'mode-accept-edits',
  plan: 'mode-plan',
  auto: 'mode-auto',
  dontAsk: 'mode-dont-ask',
  bypassPermissions: 'mode-bypass-permissions',
}

// The session config categories ACP reserves for the controls Argo's composer draws.
export const ACP_TURN_SETTING_CATEGORIES = {
  model: 'model',
  effort: 'thought_level',
  mode: 'mode',
} as const

const choiceSchema = z.object({
  value: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
})
const groupSchema = z.object({ group: z.string(), options: z.array(choiceSchema) })
const selectSchema = z.object({
  id: z.string().min(1),
  type: z.literal('select'),
  category: z.string().nullish(),
  currentValue: z.string().min(1),
  options: z.array(z.union([choiceSchema, groupSchema])),
})
type Select = z.infer<typeof selectSchema>

function choices(select: Select) {
  return select.options.flatMap((option) => ('group' in option ? option.options : [option]))
}

const categorySchema = z.object({ category: z.string() })

export type AcpConfigSelect =
  | { kind: 'reported'; select: Select & { choices: z.infer<typeof choiceSchema>[] } }
  | { kind: 'invalid'; error: z.ZodError }
  | { kind: 'absent' }

// The option in `category`, or why it cannot be read; options in other categories are not checked.
export function acpConfigSelect(options: readonly unknown[], category: string): AcpConfigSelect {
  const option = options.find(
    (candidate) => categorySchema.safeParse(candidate).data?.category === category,
  )
  if (option === undefined) return { kind: 'absent' }
  const parsed = selectSchema.safeParse(option)
  return parsed.success
    ? { kind: 'reported', select: { ...parsed.data, choices: choices(parsed.data) } }
    : { kind: 'invalid', error: parsed.error }
}

const exactReading = (value: string) => ({ exact: [value], prefixes: [] })

// Projects a fresh Session's config options into the catalog; an unreadable one counts in `rejected`.
export function acpHarnessInfo(
  harness: Harness,
  configOptions: readonly unknown[],
  label: string,
): { info: HarnessInfo; rejected: number } {
  const readings = Object.values(ACP_TURN_SETTING_CATEGORIES).map((category) =>
    acpConfigSelect(configOptions, category),
  )
  const rejected = readings.filter((reading) => reading.kind === 'invalid').length
  const [model, effort, mode] = readings.map((reading) =>
    reading.kind === 'reported' ? reading.select : null,
  )
  const efforts = effort?.choices ?? []
  const parsed = harnessInfoSchema.safeParse({
    harness,
    availability: 'available',
    agent: label,
    label,
    defaultModelId: model?.currentValue ?? 'default',
    models: (model?.choices ?? []).map((choice) => ({
      value: choice.value,
      label: choice.name,
      ...(choice.description ? { detail: choice.description } : {}),
      efforts: efforts.map(({ value }) => value),
      defaultEffort: effort?.currentValue ?? 'default',
      readings: exactReading(choice.value),
    })),
    efforts: efforts.map((choice) => ({
      value: choice.value,
      label: choice.name,
      readings: exactReading(choice.value),
    })),
    modes: (mode?.choices ?? []).map((choice) => ({
      value: choice.value,
      label: choice.name,
      detail: choice.description ?? '',
      icon: MODE_ICONS[choice.value] ?? 'mode-manual',
      readings: exactReading(choice.value),
    })),
    opening: {
      model: model?.currentValue ?? 'default',
      effort: effort?.currentValue ?? 'default',
      mode: mode?.currentValue ?? 'default',
    },
  })
  return {
    info: parsed.success ? parsed.data : invalidCatalogResponse(harness, parsed.error),
    rejected,
  }
}
