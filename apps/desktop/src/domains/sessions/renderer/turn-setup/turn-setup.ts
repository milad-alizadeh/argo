import type { LucideIcon } from 'lucide-react'
import { z } from 'zod'

import type { SessionSetup } from '@/domains/sessions/contract/model/models'
import {
  type ComposerIdentity,
  composerIdentityKey,
} from '@/domains/sessions/renderer/composer/composer-identity'

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
  reads: (reading: string) => boolean
  efforts?: readonly string[]
}
export type ModeChoice = SetupChoice & { detail: string; icon: LucideIcon }

// What one adapter lets a person set; an adapter that declares none draws no control.
export type TurnSetupChoices = {
  agent: string
  label: string
  models: SetupChoice[]
  efforts: SetupChoice[]
  modes: ModeChoice[]
  opening: TurnSetup
}

const FIELDS = ['model', 'effort', 'mode'] as const
type SetupField = (typeof FIELDS)[number]

function fieldChoices(choices: TurnSetupChoices, field: SetupField, model?: string): SetupChoice[] {
  if (field !== 'effort' || model === undefined)
    return { model: choices.models, effort: choices.efforts, mode: choices.modes }[field]
  const supported = choices.models.find((choice) => choice.value === model)?.efforts
  return supported === undefined
    ? choices.efforts
    : choices.efforts.filter((choice) => supported.includes(choice.value))
}

export function effortChoices(choices: TurnSetupChoices, model: string) {
  return fieldChoices(choices, 'effort', model)
}

function choiceRead(choices: TurnSetupChoices, field: SetupField, reading: string | null) {
  return reading === null
    ? undefined
    : fieldChoices(choices, field).find((choice) => choice.reads(reading))
}

export function choiceLabel(choices: TurnSetupChoices, field: SetupField, value: string) {
  return fieldChoices(choices, field).find((choice) => choice.value === value)?.label ?? value
}

export function setupFromReading(choices: TurnSetupChoices, reading: SessionSetup): TurnSetup {
  const read = (field: SetupField) =>
    choiceRead(choices, field, reading[field])?.value ?? choices.opening[field]
  return { model: read('model'), effort: read('effort'), mode: read('mode') }
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
  const keep = (field: SetupField) =>
    fieldChoices(choices, field, field === 'effort' ? model : undefined).some(
      (choice) => choice.value === setup[field],
    )
      ? setup[field]
      : fallback[field]
  return { model, effort: keep('effort'), mode: keep('mode') }
}

// What a composer shows: an explicit choice wins; a draft with none falls to the remembered
// Model and Effort; a Session with none reads what its roster row last settled on.
export function resolvedTurnSetup(
  choices: TurnSetupChoices,
  request: {
    identity: ComposerIdentity
    chosen: Map<string, TurnSetup>
    rows: readonly { id: string; setup: SessionSetup }[]
    remembered: Partial<Pick<TurnSetup, 'model' | 'effort'>>
  },
): TurnSetup {
  const { identity, chosen, rows, remembered } = request
  const explicit = chosen.get(composerIdentityKey(identity))
  if (explicit !== undefined) return explicit
  const row =
    identity.kind === 'session' ? rows.find(({ id }) => id === identity.sessionId) : undefined
  return row === undefined
    ? supportedSetup(choices, { ...choices.opening, ...remembered }, choices.opening)
    : setupFromReading(choices, row.setup)
}

// Model and Effort land only with a reply, so a Turn is judged once it replied or stopped.
export function turnSettled(
  row: { turnStartedAt: string | null; status: string; setup: SessionSetup },
  since: string | null,
): boolean {
  if (row.turnStartedAt === null || row.turnStartedAt === since) return false
  return row.status !== 'running' || (row.setup.model !== null && row.setup.effort !== null)
}

// A choice the reading contradicts goes back to what the Harness used, and the message says which.
export function refusalOf(
  choices: TurnSetupChoices,
  requested: TurnSetup,
  reading: SessionSetup,
): { setup: TurnSetup; message: string } | null {
  const refused = FIELDS.flatMap((field) => {
    const used = reading[field]
    if (used === null) return []
    const choice = choiceRead(choices, field, used)
    if (choice?.value === requested[field]) return []
    return [{ field, used: choice?.value ?? null, label: choice?.label ?? used }]
  })
  if (refused.length === 0) return null
  const setup = { ...requested }
  for (const { field, used } of refused) if (used !== null) setup[field] = used
  return {
    setup,
    message: refused
      .map(
        ({ field, label }) =>
          `${choices.agent} used ${label}, not ${choiceLabel(choices, field, requested[field])}.`,
      )
      .join(' '),
  }
}
