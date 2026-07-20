import type { RailTone } from '@/shared/ship'

export const AGENT_STATES = ['running', 'done', 'failed', 'queued'] as const

/** Where an Agent stands. An Agent is a PROCESS the session dispatched, never a tool call. */
export type AgentState = (typeof AGENT_STATES)[number]

// The roster speaks its states in lowercase, so the word IS the state and only the tone
// needs a lookup. Names a `--tone-*` token, never a colour; `null` means the state spends
// no hue at all, which is what keeps a row to at most one.
export const AGENT_TONE: Record<AgentState, RailTone | null> = {
  running: 'run',
  done: null,
  failed: 'red',
  queued: null,
}

/** The colour a state word wears inside the trailing meta unit. A toneless state inherits
 * the unit's faint ink rather than naming a second colour. */
export function agentStateWordClass(state: AgentState): string | undefined {
  const tone = AGENT_TONE[state]
  return tone ? `text-tone-${tone}` : undefined
}

/** A state word is noise where the enclosing group already said it: running and failed
 * always inform, done and queued only when they differ from the rollup. A lone row has no
 * rollup, so it always shows its word. */
export function showsAgentStateWord(state: AgentState, rollupState?: AgentState): boolean {
  switch (state) {
    case 'running':
    case 'failed':
      return true
    default:
      return state !== rollupState
  }
}

export function doneAgentCount(members: readonly { state: AgentState }[]): number {
  return members.filter((member) => member.state === 'done').length
}
