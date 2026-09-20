import { FileCheck2, Hand, ListTodo, ShieldAlert, ShieldX, WandSparkles } from 'lucide-react'

import {
  CLAUDE_EFFORTS,
  CLAUDE_MODELS,
  type ClaudeTurnSetup,
} from '@/agents/claude/drive/turn-setup-contract'
import type {
  ModeChoice,
  SetupChoice,
  TurnSetupChoices,
} from '@/domains/sessions/renderer/turn-setup/turn-setup'

type ClaudeModel = ClaudeTurnSetup['model']
type ClaudeEffort = ClaudeTurnSetup['effort']

// An alias names a family, and the transcript names the model id it resolved to.
const MODELS: Record<ClaudeModel, Omit<SetupChoice, 'value' | 'reads'>> = {
  fable: { label: 'Fable 5.1', detail: 'Deepest reasoning for long, open-ended work' },
  opus: { label: 'Opus 5', detail: 'Most capable for architecture and hard problems' },
  sonnet: { label: 'Sonnet 5', detail: 'Balanced for daily coding and review' },
  haiku: { label: 'Haiku 4.5', detail: 'Fast for small changes and quick answers' },
}

const EFFORTS: Record<ClaudeEffort, string> = {
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
    icon: WandSparkles,
    reads: (reading) => reading === 'auto',
  },
  {
    value: 'manual',
    label: 'Manual',
    detail: 'Ask before making changes',
    icon: Hand,
    reads: (reading) => reading === 'manual' || reading === 'default',
  },
  {
    value: 'acceptEdits',
    label: 'Accept edits',
    detail: 'Accept file edits automatically',
    icon: FileCheck2,
    reads: (reading) => reading === 'acceptEdits',
  },
  {
    value: 'plan',
    label: 'Plan',
    detail: 'Create a plan before making changes',
    icon: ListTodo,
    reads: (reading) => reading === 'plan',
  },
  {
    value: 'dontAsk',
    label: "Don't ask",
    detail: 'Deny anything not approved in advance',
    icon: ShieldX,
    reads: (reading) => reading === 'dontAsk',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass',
    detail: 'Run without permission checks',
    icon: ShieldAlert,
    reads: (reading) => reading === 'bypassPermissions',
  },
]

export const CLAUDE_TURN_SETUP: TurnSetupChoices = {
  agent: 'Claude',
  label: 'Claude Code',
  models: CLAUDE_MODELS.map((value) => ({
    value,
    ...MODELS[value],
    reads: (reading) => reading === value || reading.startsWith(`claude-${value}-`),
  })),
  efforts: CLAUDE_EFFORTS.map((value) => ({
    value,
    label: EFFORTS[value],
    reads: (reading) => reading === value,
  })),
  modes: MODES,
  opening: { model: 'opus', effort: 'medium', mode: 'manual' },
}
