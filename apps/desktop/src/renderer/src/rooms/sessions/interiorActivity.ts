import type {
  PlanEntry,
  SessionView,
  StopReason,
  ToolCall,
  ToolCallKind,
  ToolCallStatus,
  Turn,
} from '@shared'
import { rootAgent } from '@shared'
import {
  type ActivityDot,
  type SubagentGroupModel,
  stepDot,
  subagentGroup,
  subagentRow,
  subagentsOf,
  toolCallsOf,
} from './interiorSubagents'

// The Activity surface's derivation: the Timeline, and the ONE ordered item list the master list and
// the detail feed both read. Built once so the two panes cannot fall out of step.

export interface PlanProgressModel {
  done: number
  total: number
  entries: readonly PlanEntry[]
}

export interface ToolStepModel {
  key: string
  name: string
  /** What the call did, CLI-agnostic — the word the detail feed's gutter reads. The host's own
   * tool name travels beside it in `name`, so neither one is renamed away. */
  kind: ToolCallKind
  target: string | null
  status: ToolCallStatus
  dot: ActivityDot
}

export interface TimelineTurnModel {
  key: string
  /** Open: no stop reason observed yet, which is the signal the session is still working. */
  open: boolean
  /** `unknown` is rendered as itself — a guessed reason would be a fabricated fact. */
  stopReason: StopReason | null
  plan: PlanProgressModel | null
  steps: readonly ToolStepModel[]
  /** A compaction marker sits in FRONT of this turn, so condensed history reads as continuous. */
  compactedBefore: boolean
}

/** One selectable thing, in the order the master list draws it and the detail feed concatenates it:
 * every subagent first, then this session's turn steps. It carries its own detail, so the two panes
 * read one list rather than each looking the item up again. */
export type ActivityItem =
  | {
      key: string
      kind: 'subagent'
      subagent: ReturnType<typeof subagentRow>
      /** The phase the CLI reported for it, absent where it reported none — the detail head's
       * meta line names it rather than inventing one. */
      group: string | null
      /** The subagent's live feed — its own tool calls, in the order it made them. */
      events: readonly ToolStepModel[]
    }
  | { key: string; kind: 'step'; step: ToolStepModel }

export interface ActivityModel {
  /** `null` where the session spawned none: there is no group to collapse, so none is drawn. */
  subagents: SubagentGroupModel | null
  /** Newest turn first — the open one leads, past turns fold behind it. */
  turns: readonly TimelineTurnModel[]
  items: readonly ActivityItem[]
}

function planProgress(turn: Turn): PlanProgressModel | null {
  if (turn.plan === null) return null
  const { entries } = turn.plan
  return {
    done: entries.filter((entry) => entry.status === 'completed').length,
    total: entries.length,
    entries,
  }
}

function toolStep(call: ToolCall): ToolStepModel {
  return {
    key: `step:${call.id}`,
    name: call.name,
    kind: call.kind,
    target: call.target,
    status: call.status,
    dot: stepDot(call.status),
  }
}

function timelineTurn(turn: Turn, compacted: ReadonlySet<string>): TimelineTurnModel {
  return {
    key: `turn:${turn.id}`,
    open: turn.stopReason === null,
    stopReason: turn.stopReason,
    plan: planProgress(turn),
    steps: turn.toolCalls.map(toolStep),
    compactedBefore: compacted.has(turn.id),
  }
}

function spawnedItems(session: SessionView): ActivityItem[] {
  return subagentsOf(session).map((agent) => {
    const row = subagentRow(agent)
    return {
      key: row.key,
      kind: 'subagent',
      subagent: row,
      group: agent.group ?? null,
      events: toolCallsOf(agent).map(toolStep),
    }
  })
}

/**
 * The Activity surface's whole view-model, built from the session's own root Agent.
 *
 * An unparseable transcript yields no root, which renders as an empty surface rather than an
 * error: observation failure is not work failure (`cockpit-failure-states-spec.md` §8).
 */
export function buildActivity(session: SessionView): ActivityModel {
  const root = rootAgent(session.agents)
  const compacted = new Set(root?.compactions.map((mark) => mark.beforeTurnId) ?? [])
  const turns = (root?.turns ?? []).map((turn) => timelineTurn(turn, compacted)).reverse()
  return {
    subagents: subagentGroup(session),
    turns,
    items: [
      ...spawnedItems(session),
      ...turns.flatMap((turn) =>
        turn.steps.map((step): ActivityItem => ({ key: step.key, kind: 'step', step })),
      ),
    ],
  }
}
