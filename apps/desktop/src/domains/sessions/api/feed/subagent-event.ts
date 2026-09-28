import type { BackgroundState } from './background-task-record'

// One step in a Subagent's life, as its adapter read it. `responded` alone carries an end state,
// and every fact is absent where the harness does not give it (CONTEXT.md L3 · Subagent).
export const SUBAGENT_EVENTS = ['started', 'messaged', 'responded'] as const
export type SubagentEventName = (typeof SUBAGENT_EVENTS)[number]

export type SubagentFacts = {
  name?: string
  type?: string
  model?: string
  durationMs?: number
  tokens?: number
  // The reply's first line, on `responded` only.
  text?: string
}

export type SubagentEvent = SubagentFacts & {
  kind: 'subagent'
  uuid: string
  timestamp: string | null
  // The spawning call or the child thread, as the adapter names it: what the child's own Feed is read by.
  subagentId: string
} & (
    | { event: 'started' | 'messaged' }
    | { event: 'responded'; state: BackgroundState; reply?: string }
  )

// A collaboration call the Subagent events read a fact from: the model a spawn chose, or the target a stop names.
export type SubagentCall = {
  intent: 'start' | 'stop'
  callId: string
  timestamp: string | null
  target: string | null
  model: string | null
}
