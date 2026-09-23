import {
  type ClaudeModelCatalog,
  claudeModelsWithEffort,
} from '@/domains/sessions/contract/claude-model-catalog'
import { CLAUDE_FALLBACK_SETUP } from '@/domains/sessions/contract/ipc/contract'
import type { ModeChoice, TurnSetupChoices } from './turn-setup'

// An alias names a family, and the transcript names the model id it resolved to.
const EFFORTS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

// Claude writes `default` for the Mode its flag calls `manual`.
const MODES: ModeChoice[] = [
  {
    value: 'auto',
    label: 'Auto',
    detail: 'Claude handles permission decisions',
    icon: 'mode-auto',
    reads: (reading) => reading === 'auto',
  },
  {
    value: 'manual',
    label: 'Manual',
    detail: 'Ask before making changes',
    icon: 'mode-manual',
    reads: (reading) => reading === 'manual' || reading === 'default',
  },
  {
    value: 'acceptEdits',
    label: 'Accept edits',
    detail: 'Accept file edits automatically',
    icon: 'mode-accept-edits',
    reads: (reading) => reading === 'acceptEdits',
  },
  {
    value: 'plan',
    label: 'Plan',
    detail: 'Create a plan before making changes',
    icon: 'mode-plan',
    reads: (reading) => reading === 'plan',
  },
  {
    value: 'dontAsk',
    label: "Don't ask",
    detail: 'Deny anything not approved in advance',
    icon: 'mode-dont-ask',
    reads: (reading) => reading === 'dontAsk',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass',
    detail: 'Run without permission checks',
    icon: 'mode-bypass-permissions',
    reads: (reading) => reading === 'bypassPermissions',
  },
]

export function claudeTurnSetup(catalog: ClaudeModelCatalog | null): TurnSetupChoices {
  if (catalog === null) {
    return {
      agent: 'Claude',
      label: 'Claude Code',
      models: [
        {
          value: CLAUDE_FALLBACK_SETUP.model,
          label: 'Sonnet',
          efforts: [CLAUDE_FALLBACK_SETUP.effort],
          defaultEffort: CLAUDE_FALLBACK_SETUP.effort,
          reads: (reading) => reading === CLAUDE_FALLBACK_SETUP.model,
        },
      ],
      efforts: [
        {
          value: CLAUDE_FALLBACK_SETUP.effort,
          label: 'Medium',
          reads: (reading) => reading === CLAUDE_FALLBACK_SETUP.effort,
        },
      ],
      modes: MODES,
      opening: { ...CLAUDE_FALLBACK_SETUP, mode: 'manual' },
      source: 'fallback',
    }
  }
  const models = claudeModelsWithEffort(catalog)
  const openingModel = models.find(({ value }) => value === 'opus') ?? models[0]
  if (openingModel === undefined) return claudeTurnSetup(null)
  const openingEffort = openingModel.supportedEffortLevels.includes('medium')
    ? 'medium'
    : (openingModel.supportedEffortLevels[0] ?? CLAUDE_FALLBACK_SETUP.effort)
  return {
    agent: 'Claude',
    label: 'Claude Code',
    models: models.map(
      ({ value, resolvedModel, displayName, description, supportedEffortLevels }) => ({
        value,
        label: displayName,
        detail: description || undefined,
        efforts: supportedEffortLevels,
        defaultEffort: supportedEffortLevels.includes('medium')
          ? 'medium'
          : supportedEffortLevels[0],
        reads: (reading) => reading === value || reading === resolvedModel,
      }),
    ),
    efforts: [...new Set(models.flatMap(({ supportedEffortLevels }) => supportedEffortLevels))].map(
      (value) => ({
        value,
        label: EFFORTS[value] ?? value,
        reads: (reading) => reading === value,
      }),
    ),
    modes: MODES,
    opening: { model: openingModel.value, effort: openingEffort, mode: 'manual' },
  }
}

export const CLAUDE_TURN_SETUP = claudeTurnSetup(null)
