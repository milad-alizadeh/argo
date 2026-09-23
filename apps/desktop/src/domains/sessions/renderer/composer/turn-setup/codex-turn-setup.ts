import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import {
  CODEX_EFFORTS,
  CODEX_MODELS,
  codexEfforts,
  codexOpeningSetupFor,
} from '@/domains/sessions/contract/codex-turn-setup'
import type { ModeChoice, TurnSetupChoices } from './turn-setup'

const effortLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra',
}

const modelDetails: Record<string, string> = {
  'gpt-5.6-sol': 'Reliable agentic workhorse for everyday tasks',
  'gpt-5.6-terra': 'Balanced agentic coding model for everyday work',
  'gpt-5.6-luna': 'Fast and affordable agentic coding model',
  'gpt-5.5': 'Proven previous-generation model for coding and general work',
  'gpt-5.3-codex-spark': 'Ultra-fast coding model',
}

const MODES: ModeChoice[] = [
  {
    value: 'read-only',
    label: 'Ask first',
    detail: 'Read-only work asks before any change',
    icon: 'mode-manual',
    reads: (value) => value === 'read-only',
  },
  {
    value: 'workspace-write',
    label: 'Approve safely',
    detail: 'Work in this project, asking at the boundary',
    icon: 'mode-approve-safely',
    reads: (value) => value === 'workspace-write',
  },
  {
    value: 'danger-full-access',
    label: 'Full access',
    detail: 'Work without permission prompts',
    icon: 'mode-bypass-permissions',
    reads: (value) => value === 'danger-full-access',
  },
]

export function codexTurnSetup(catalog: CodexModelCatalog | null): TurnSetupChoices {
  const models = catalog?.data.filter(({ hidden }) => !hidden) ?? []
  if (models.length === 0) return CODEX_FALLBACK_TURN_SETUP
  const efforts = [
    ...new Set(
      models.flatMap(({ supportedReasoningEfforts }) =>
        supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
      ),
    ),
  ]
  const opening = codexOpeningSetupFor(catalog)
  return {
    agent: 'Codex',
    label: 'Codex',
    models: models.map(({ model, displayName, description, supportedReasoningEfforts }) => ({
      value: model,
      label: displayName,
      detail: description,
      efforts: supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
      reads: (reading) => reading === model,
    })),
    efforts: efforts.map((value) => ({
      value,
      label:
        effortLabels[value] ??
        value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      reads: (reading) => reading === value,
    })),
    modes: MODES,
    opening,
  }
}

export const CODEX_FALLBACK_TURN_SETUP: TurnSetupChoices = {
  source: 'fallback',
  agent: 'Codex',
  label: 'Codex',
  models: CODEX_MODELS.map((value) => ({
    value,
    label: value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    detail: modelDetails[value],
    efforts: codexEfforts(value),
    reads: (reading) => reading === value,
  })),
  efforts: CODEX_EFFORTS.map((value) => ({
    value,
    label: effortLabels[value] ?? value,
    reads: (reading) => reading === value,
  })),
  modes: MODES,
  opening: { model: 'gpt-5.6-sol', effort: 'low', mode: 'workspace-write' },
}

export const CODEX_TURN_SETUP = CODEX_FALLBACK_TURN_SETUP
