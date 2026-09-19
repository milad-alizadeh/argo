// The one shape the Subagent thread card reads. A Codex `SubAgentActivity` event carries kind
// `started | interacted | completed`, a name, a status, a progress line and the child's own
// Session id; this is that event folded into the lifecycle a card draws.
import type { TFunction } from 'i18next'
import { useEffect, useState } from 'react'
import {
  readableDelegationName,
  spentTokens,
  type WorkState,
  workDuration,
} from '../../components/work/session-work'
import { joined } from '../../components/work/session-work-entries'

export type DelegationPhase = 'running' | 'succeeded' | 'failed'

export type AgentThread = {
  id: string
  // The raw name the event carries, such as `semantic_compound_verify`.
  name: string
  phase: DelegationPhase
  // The newest line the child reported while it was still working.
  progress: string | null
  // What the child handed back once it landed.
  result: string | null
  startedAt: string | null
  endedAt: string | null
  tokens: number | null
  model: string | null
}

// The card borrows the shipped state marks rather than inventing a second colour set.
export const PHASE_STATES: Record<DelegationPhase, WorkState> = {
  running: 'running',
  succeeded: 'done',
  failed: 'failed',
}

const FAILED_STATES: ReadonlySet<WorkState> = new Set(['failed', 'interrupted'])

// A block whose linked work is unknown still runs, as far as the Feed can tell.
export function phaseOfState(state: WorkState | null): DelegationPhase {
  if (state === null || state === 'running') return 'running'
  return FAILED_STATES.has(state) ? 'failed' : 'succeeded'
}

// A running card is measured against a live clock; a settled one needs none, so the interval only
// exists while something is still going.
export function useDelegationClock(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [ticking])
  return now
}

export function isRunning(agents: readonly AgentThread[]): boolean {
  return agents.some((agent) => agent.phase === 'running')
}

export type DelegationFacts = {
  title: string
  // The state the header list names for the same Subagent, read out loud only.
  state: string
  // Model, duration and spend, worded and joined exactly as the header list words them.
  facts: string
  // The line the card shows: the live progress while running, the result once it landed.
  line: string | null
}

export function delegationFacts(
  agent: AgentThread,
  now: number,
  t: TFunction<'sessions'>,
): DelegationFacts {
  return {
    title: readableDelegationName(agent.name),
    state: t(`workState.${PHASE_STATES[agent.phase]}`),
    facts: joined([
      agent.model,
      workDuration(agent.startedAt, agent.endedAt, now),
      spentTokens(agent.tokens, t),
    ]),
    line: agent.phase === 'running' ? agent.progress : agent.result,
  }
}
