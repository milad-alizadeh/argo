import type { Agent, SessionView, ToolCall } from '@shared'
import { openTurn } from '@shared'
import { type ActivityDot, SUBAGENT_STATES, type SubagentStatus } from './activityStates'
import { tokenSpend } from './contextEstimate'
import { duration } from './sessionClock'

// The Subagents group's derivation. The one judgement here worth reading on its own is the
// blueprint's per-CLI degradation: the cockpit never invents a phase a CLI did not report.

/** How much structure the CLI reported about its subagents: `phased` where the subagents name a
 * group, `labelled` where they only name themselves, `flat` otherwise. */
export type BlueprintTier = 'phased' | 'labelled' | 'flat'

export interface SubagentRowModel {
  key: string
  /** The subagent's own label, or its id where the CLI reported none. */
  name: string
  /** What it is working on — the newest tool call's target. `null` where it has touched nothing. */
  target: string | null
  status: SubagentStatus
  dot: ActivityDot
  /** How long it has been working, or how long it took. `null` for a subagent whose spawning call
   * carried no time — a fanout you cannot time is not a fanout that took no time. */
  took: string | null
  /** What it spent, as the host reported it when the delegate finished. `null` while it is still
   * running: the spend arrives with the result, so a running subagent has no figure yet and a `0`
   * would read as a delegate that cost nothing. */
  tokens: string | null
}

export interface SubagentGroupModel {
  tier: BlueprintTier
  /** The ONE phase every subagent reports, or `null`. Null covers both a CLI that reported no
   * phases and a phased blueprint whose subagents sit in MORE than one: naming the first of several
   * over rows that mostly belong to another is the invented fact the tier gating exists to refuse.
   * A mixed set says its count instead, and each row's own phase reaches its detail head. */
  group: string | null
  /** What the section header says beside `Subagents`, derived once so the navigation pane and the
   * detail feed's heading cannot spell one summary two ways. */
  summary: string
  rows: readonly SubagentRowModel[]
  runningCount: number
}

function subagentStatus(agent: Agent): SubagentStatus {
  if (openTurn(agent) !== null) return 'running'
  return agent.turns.length === 0 ? 'queued' : 'done'
}

export const toolCallsOf = (agent: Agent): ToolCall[] =>
  agent.turns.flatMap((turn) => turn.toolCalls)

export const subagentsOf = (session: SessionView): Agent[] =>
  session.agents.filter((agent) => agent.parentId !== null)

export function subagentRow(agent: Agent, nowMs: number | null): SubagentRowModel {
  const status = subagentStatus(agent)
  return {
    key: `subagent:${agent.id}`,
    name: agent.label ?? agent.id,
    target: toolCallsOf(agent).at(-1)?.target ?? null,
    status,
    dot: SUBAGENT_STATES[status].dot,
    took: duration(agent.startedAtMs, agent.endedAtMs, nowMs),
    tokens: tokenSpend(agent.usage),
  }
}

// `group` is the phased blueprint's own name and `label` the labelled tree's, both tier-gated on
// the tree (CONTEXT.md L3) — so the tier is whichever the subagents actually carry, and a bare CLI
// lands on `flat` with nothing but a count.
function blueprintTier(agents: readonly Agent[]): BlueprintTier {
  if (agents.some((agent) => agent.group !== undefined)) return 'phased'
  return agents.some((agent) => agent.label !== undefined) ? 'labelled' : 'flat'
}

// The phase the whole group is in, or null the moment they disagree — including when only some of
// them reported one, since the rest are then in no named phase at all.
function sharedPhase(agents: readonly Agent[]): string | null {
  const phases = new Set(agents.map((agent) => agent.group ?? null))
  const [only] = [...phases]
  return phases.size === 1 && only !== undefined ? only : null
}

/** The Subagents group, or `null` when the session spawned none. Never interleaved into the
 * timeline: two sections, one header style (`cockpit-spec.md` §4.2). */
export function subagentGroup(
  session: SessionView,
  nowMs: number | null,
): SubagentGroupModel | null {
  const children = subagentsOf(session)
  if (children.length === 0) return null
  const rows = children.map((agent) => subagentRow(agent, nowMs))
  const group = sharedPhase(children)
  const runningCount = rows.filter((row) => row.status === 'running').length
  return {
    tier: blueprintTier(children),
    group,
    // A named phase replaces the count rather than joining it: the phase is the more specific fact,
    // and the rows below are the count.
    summary:
      group === null
        ? `${rows.length} · ${runningCount} running`
        : `${group} · ${runningCount} running`,
    rows,
    runningCount,
  }
}
