import {
  type ClaudeModelCatalog,
  claudeModelsWithEffort,
  claudePermissionModes,
} from '@/domains/sessions/contract/claude-model-catalog'
import { claudeOpeningSetupFor } from '@/domains/sessions/contract/claude-turn-setup'
import type { ModeChoice, TurnSetupChoices } from './turn-setup'

// An alias names a family, and the transcript names the model id it resolved to.
const EFFORTS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

const MODE_PRESENTATION: Record<string, Pick<ModeChoice, 'label' | 'detail' | 'icon'>> = {
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

export function claudeTurnSetup(catalog: ClaudeModelCatalog | null): TurnSetupChoices | null {
  if (catalog === null) return null
  const models = claudeModelsWithEffort(catalog)
  const modes = claudePermissionModes(catalog)
  if (models.length === 0 || modes.length === 0) return null
  const opening = claudeOpeningSetupFor(catalog)
  if (opening === null) return null
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
    modes: modes.map((value) => {
      const presentation = MODE_PRESENTATION[value] ?? {
        label: value,
        detail: 'Permission mode reported by Claude Code',
        icon: 'mode-manual',
      }
      return {
        value,
        ...presentation,
        reads: (reading) => reading === value || (value === 'manual' && reading === 'default'),
      }
    }),
    opening,
  }
}
