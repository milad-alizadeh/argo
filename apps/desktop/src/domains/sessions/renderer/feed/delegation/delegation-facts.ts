// The one shape the Subagent row reads: one lifecycle event, as the card draws it.
import type { TFunction } from 'i18next'
import {
  durationText,
  readableDelegationName,
  spentTokens,
} from '@/domains/sessions/renderer/work/session-work'
import { joined } from '@/domains/sessions/renderer/work/session-work-entries'

export type DelegationPhase = 'running' | 'succeeded' | 'failed'

export type AgentThread = {
  id: string
  // The raw name the event carries, such as `semantic_compound_verify`.
  name: string
  phase: DelegationPhase
  // The line the row draws: what the Subagent reported, or the reply it handed back.
  line: string | null
  durationMs: number | null
  tokens: number | null
  model: string | null
}

export type DelegationFacts = {
  title: string
  // The state the header list names for the same Subagent, read out loud only.
  state: string
  // Model, duration and spend, worded and joined exactly as the header list words them.
  facts: string
  line: string | null
}

const PHASE_STATE_KEYS = {
  running: 'running',
  succeeded: 'done',
  failed: 'failed',
} as const

export function delegationFacts(agent: AgentThread, t: TFunction<'sessions'>): DelegationFacts {
  return {
    title: readableDelegationName(agent.name),
    state: t(`workState.${PHASE_STATE_KEYS[agent.phase]}`),
    facts: joined([agent.model, durationText(agent.durationMs), spentTokens(agent.tokens, t)]),
    line: agent.line,
  }
}
