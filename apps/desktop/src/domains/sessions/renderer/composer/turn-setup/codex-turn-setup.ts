import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import { codexOpeningSetupFor } from '@/domains/sessions/contract/codex-turn-setup'
import type { ModeChoice, TurnSetupChoices } from './turn-setup'

const effortLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra',
}
const effortOrder = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']

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

export function codexTurnSetup(catalog: CodexModelCatalog | null): TurnSetupChoices | null {
  if (catalog === null) return null
  const models = catalog.data.filter(({ hidden }) => !hidden)
  if (models.length === 0) return null
  const efforts = [
    ...new Set(
      models.flatMap(({ supportedReasoningEfforts }) =>
        supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
      ),
    ),
  ]
  efforts.sort((first, second) => {
    const firstRank = effortOrder.indexOf(first)
    const secondRank = effortOrder.indexOf(second)
    if (firstRank === -1) return secondRank === -1 ? 0 : 1
    if (secondRank === -1) return -1
    return firstRank - secondRank
  })
  const opening = codexOpeningSetupFor(catalog)
  if (opening === null) return null
  return {
    agent: 'Codex',
    label: 'Codex',
    models: models.map(
      ({ model, displayName, description, defaultReasoningEffort, supportedReasoningEfforts }) => ({
        value: model,
        label: displayName,
        detail: description,
        efforts: supportedReasoningEfforts.map(({ reasoningEffort }) => reasoningEffort),
        defaultEffort: defaultReasoningEffort,
        reads: (reading) => reading === model,
      }),
    ),
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
