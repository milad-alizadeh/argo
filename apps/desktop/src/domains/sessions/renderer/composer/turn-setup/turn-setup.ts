import { z } from 'zod'

import type { SessionSetup } from '@/domains/sessions/contract/model/models'
import type { AvailableHarness, CatalogReading } from '@/harnesses/catalog/harness-catalog-machine'
import type { IconName } from '@/platform/renderer/components/icon/icon'

// The Model, Effort and Mode a composer sends with its next Turn (CONTEXT.md L2 · Model and Effort).
export const turnSetupSchema = z.strictObject({
  model: z.string(),
  effort: z.string(),
  mode: z.string(),
})
export type TurnSetup = z.infer<typeof turnSetupSchema>

// `reads` says whether a word the Harness wrote to its transcript means this choice.
export type SetupChoice = {
  value: string
  label: string
  detail?: string
  readings: CatalogReading
  efforts?: readonly string[]
  supportedModes?: readonly string[]
  defaultEffort?: string
}
export type ModeChoice = SetupChoice & { detail: string; icon: IconName }

// What one adapter lets a person set; an adapter that declares none draws no control.
export type TurnSetupChoices = Pick<
  AvailableHarness,
  'agent' | 'label' | 'models' | 'efforts' | 'modes' | 'opening'
>

const FIELDS = ['model', 'effort', 'mode'] as const
type SetupField = (typeof FIELDS)[number]

function fieldChoices(choices: TurnSetupChoices, field: SetupField, model?: string): SetupChoice[] {
  if (field === 'mode' && model !== undefined) return modeChoices(choices, model)
  if (field !== 'effort' || model === undefined)
    return { model: choices.models, effort: choices.efforts, mode: choices.modes }[field]
  const supported = choices.models.find((choice) => choice.value === model)?.efforts
  return supported === undefined
    ? choices.efforts
    : supported.flatMap((value) => choices.efforts.filter((choice) => choice.value === value))
}

export function modeChoices(choices: TurnSetupChoices, model: string) {
  const supported = choices.models.find((choice) => choice.value === model)?.supportedModes
  return supported === undefined
    ? choices.modes
    : choices.modes.filter((choice) => supported.includes(choice.value))
}

export function effortChoices(choices: TurnSetupChoices, model: string) {
  return fieldChoices(choices, 'effort', model)
}

function choiceRead(
  choices: TurnSetupChoices,
  request: { field: SetupField; reading: string | null; model?: string },
) {
  const { field, reading, model } = request
  return reading === null
    ? undefined
    : fieldChoices(choices, field, model).find(
        (choice) =>
          choice.readings.exact.includes(reading) ||
          choice.readings.prefixes.some((prefix) => reading.startsWith(prefix)),
      )
}

export function choiceLabel(
  choices: TurnSetupChoices,
  request: { field: SetupField; value: string; model?: string },
) {
  const { field, value, model } = request
  return (
    fieldChoices(choices, field, model).find((choice) => choice.value === value)?.label ?? value
  )
}

export function setupFromReading(choices: TurnSetupChoices, reading: SessionSetup): TurnSetup {
  const model =
    choiceRead(choices, { field: 'model', reading: reading.model })?.value ?? choices.opening.model
  const effort =
    choiceRead(choices, { field: 'effort', reading: reading.effort, model })?.value ?? ''
  const mode = choiceRead(choices, { field: 'mode', reading: reading.mode, model })?.value ?? ''
  return supportedSetup(choices, { model, effort, mode }, choices.opening)
}

// A stored setup can name a choice Argo no longer offers, and that one field takes the fallback.
export function supportedSetup(
  choices: TurnSetupChoices,
  setup: TurnSetup,
  fallback: TurnSetup,
): TurnSetup {
  const model = fieldChoices(choices, 'model').some((choice) => choice.value === setup.model)
    ? setup.model
    : fallback.model
  const modelChoice = choices.models.find((choice) => choice.value === model)
  const efforts = effortChoices(choices, model)
  const effort = efforts.some((choice) => choice.value === setup.effort)
    ? setup.effort
    : (efforts.find((choice) => choice.value === modelChoice?.defaultEffort)?.value ??
      efforts[0]?.value ??
      fallback.effort)
  const modes = modeChoices(choices, model)
  const mode = modes.some((choice) => choice.value === setup.mode)
    ? setup.mode
    : (modes.find((choice) => choice.value === fallback.mode)?.value ??
      modes[0]?.value ??
      fallback.mode)
  return { model, effort, mode }
}
