import { Hand, ShieldAlert, ShieldCheck } from 'lucide-react'

import { CODEX_EFFORTS, CODEX_MODELS, codexEfforts } from '@/core/sessions/codex-contract'
import type { ModeChoice, TurnSetupChoices } from './turn-setup'

const effortLabels: Record<(typeof CODEX_EFFORTS)[number], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
  ultra: 'Ultra',
}

const modelDetails: Record<(typeof CODEX_MODELS)[number], string> = {
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
    icon: Hand,
    reads: (value) => value === 'read-only',
  },
  {
    value: 'workspace-write',
    label: 'Approve safely',
    detail: 'Work in this project, asking at the boundary',
    icon: ShieldCheck,
    reads: (value) => value === 'workspace-write',
  },
  {
    value: 'danger-full-access',
    label: 'Full access',
    detail: 'Work without permission prompts',
    icon: ShieldAlert,
    reads: (value) => value === 'danger-full-access',
  },
]

export const CODEX_TURN_SETUP: TurnSetupChoices = {
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
    label: effortLabels[value],
    reads: (reading) => reading === value,
  })),
  modes: MODES,
  opening: { model: 'gpt-5.6-sol', effort: 'low', mode: 'workspace-write' },
}
