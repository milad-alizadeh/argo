import type { Agent, SessionView, ToolCall, ToolCallStatus } from '@shared'
import { openTurn } from '@shared'
import type { DotGlow, RosterTone } from '@/shared/status'

// The Subagents group's derivation, and the dot vocabulary the whole Activity surface reads. Kept
// beside the group rather than inside the timeline's file because the blueprint's per-CLI
// degradation is the one judgement here worth reading on its own.

/** How much structure the CLI reported about its subagents. The cockpit never invents a phase a
 * CLI did not report, so the tier is read off what the tree actually carries: `phased` where the
 * subagents name a group, `labelled` where they only name themselves, `flat` otherwise. */
export type BlueprintTier = 'phased' | 'labelled' | 'flat'

/** The dot a row draws. Same three channels as the rail's, because state is carried entirely by
 * the dot wherever it appears. */
export interface ActivityDot {
  tone: RosterTone
  glow: DotGlow
  pulse: boolean
}

export interface SubagentRowModel {
  key: string
  /** The subagent's own label, or its id where the CLI reported none. */
  name: string
  /** What it is working on — the newest tool call's target. Empty where it has touched nothing. */
  target: string
  /** `running` while a turn is open, `queued` before its first, `done` once every turn closed. */
  status: 'running' | 'queued' | 'done'
  dot: ActivityDot
}

export interface SubagentGroupModel {
  tier: BlueprintTier
  /** The group's own name, present ONLY where the CLI reported one — the label the section wears
   * beside `Subagents`. */
  group: string | null
  rows: readonly SubagentRowModel[]
  runningCount: number
}

const RUNNING_DOT: ActivityDot = { tone: 'run', glow: 'live', pulse: true }
const QUEUED_DOT: ActivityDot = { tone: 'gray', glow: 'faint', pulse: false }
const DONE_DOT: ActivityDot = { tone: 'done', glow: 'quiet', pulse: false }
const FAILED_DOT: ActivityDot = { tone: 'red', glow: 'quiet', pulse: false }

/** The dot a tool call draws. A failure burns red and holds still — it is as bright as needs-you,
 * it just is not still in motion. */
export function stepDot(status: ToolCallStatus): ActivityDot {
  switch (status) {
    case 'in_progress':
      return RUNNING_DOT
    case 'completed':
      return DONE_DOT
    case 'failed':
      return FAILED_DOT
    case 'pending':
      return QUEUED_DOT
  }
}

function subagentStatus(agent: Agent): SubagentRowModel['status'] {
  if (openTurn(agent) !== null) return 'running'
  return agent.turns.length === 0 ? 'queued' : 'done'
}

function subagentDot(status: SubagentRowModel['status']): ActivityDot {
  switch (status) {
    case 'running':
      return RUNNING_DOT
    case 'queued':
      return QUEUED_DOT
    case 'done':
      return DONE_DOT
  }
}

export const toolCallsOf = (agent: Agent): ToolCall[] =>
  agent.turns.flatMap((turn) => turn.toolCalls)

export const subagentsOf = (session: SessionView): Agent[] =>
  session.agents.filter((agent) => agent.parentId !== null)

export function subagentRow(agent: Agent): SubagentRowModel {
  const status = subagentStatus(agent)
  return {
    key: `subagent:${agent.id}`,
    name: agent.label ?? agent.id,
    target: toolCallsOf(agent).at(-1)?.target ?? '',
    status,
    dot: subagentDot(status),
  }
}

// `group` is the phased blueprint's own name and `label` the labelled tree's, both tier-gated on
// the tree (CONTEXT.md L3) — so the tier is whichever the subagents actually carry, and a bare CLI
// lands on `flat` with nothing but a count.
function blueprintTier(agents: readonly Agent[]): BlueprintTier {
  if (agents.some((agent) => agent.group !== undefined)) return 'phased'
  return agents.some((agent) => agent.label !== undefined) ? 'labelled' : 'flat'
}

/** The Subagents group, or `null` when the session spawned none. Never interleaved into the
 * timeline: two sections, one header style (`cockpit-spec.md` §4.2). */
export function subagentGroup(session: SessionView): SubagentGroupModel | null {
  const children = subagentsOf(session)
  if (children.length === 0) return null
  const rows = children.map(subagentRow)
  return {
    tier: blueprintTier(children),
    group: children.find((agent) => agent.group !== undefined)?.group ?? null,
    rows,
    runningCount: rows.filter((row) => row.status === 'running').length,
  }
}
