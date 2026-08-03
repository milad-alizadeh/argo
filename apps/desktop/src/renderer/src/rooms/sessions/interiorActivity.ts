import type { SessionView, StopReason, ToolCall, ToolCallKind, ToolCallStatus, Turn } from '@shared'
import { rootAgent } from '@shared'
import { type ActivityDot, STEP_STATES } from './activityStates'
import {
  type SubagentGroupModel,
  subagentGroup,
  subagentRow,
  subagentsOf,
  toolCallsOf,
} from './interiorSubagents'
import { relativeAge } from './relativeAge'
import { type PlanProgressModel, sessionPlan } from './sessionPlan'

// The Activity surface's derivation: the Timeline, and the ONE ordered item list the master list and
// the detail feed both read. Built once so the two panes cannot fall out of step.

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
  /** Which exchange of the session this is, counted from the OLDEST. A turn keeps its number for as
   * long as the session lives — numbering from the newest would renumber every card each time the
   * agent answered, which is the one thing a list you are reading must not do. */
  ordinal: number
  /** Open: no stop reason observed yet, which is the signal the session is still working. */
  open: boolean
  /** `unknown` is rendered as itself — a guessed reason would be a fabricated fact. */
  stopReason: StopReason | null
  /** How long ago this turn ENDED — `4m`, `2h`, `3d` — or `null` for the turn still running and for
   * a record carrying no end time. Deliberately coarse: the reading is old-versus-new, and a
   * timestamp per row would cost the list the scannability the whole surface is for. */
  age: string | null
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
  /** The session's own live to-do list, or `null` where the CLI reported none. Session-scoped, so ONE
   * tracker is drawn for the surface rather than one inside every turn card. */
  plan: PlanProgressModel | null
  /** `null` where the session spawned none: there is no group to collapse, so none is drawn. */
  subagents: SubagentGroupModel | null
  /** Newest turn first — the open one leads, past turns fold behind it. */
  turns: readonly TimelineTurnModel[]
  /** The items split by WHOSE work they are, in feed order: every delegate's first, then this
   * session's own turn steps. The split is domain-meaningful, not a rendering convenience — a
   * subagent's tool call and the root Agent's are different agents' work, and a feed that
   * concatenates them behind identical seams reads as one timeline. The surface heads and indents
   * by this, so nothing downstream has to re-derive whose call it is looking at.
   *
   * `own` runs turn-descending but step-ASCENDING inside each turn, which is deliberate and is the
   * order the navigation pane draws: newest turn first because that is the work in flight, and its
   * steps in the order the agent made them because a turn read backwards is not a sequence. */
  delegated: readonly ActivityItem[]
  own: readonly ActivityItem[]
}

function toolStep(call: ToolCall): ToolStepModel {
  return {
    key: `step:${call.id}`,
    name: call.name,
    kind: call.kind,
    target: call.target,
    status: call.status,
    dot: STEP_STATES[call.status].dot,
  }
}

/** What every turn of one build shares, so the per-turn call takes a turn and its context rather
 * than four positional arguments. */
interface TimelineContext {
  compacted: ReadonlySet<string>
  ordinal: number
  nowMs: number | null
}

function timelineTurn(
  turn: Turn,
  { compacted, ordinal, nowMs }: TimelineContext,
): TimelineTurnModel {
  return {
    key: `turn:${turn.id}`,
    ordinal,
    open: turn.stopReason === null,
    stopReason: turn.stopReason,
    age: relativeAge(turn.endedAtMs, nowMs),
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
export function buildActivity(session: SessionView, nowMs: number | null = null): ActivityModel {
  const root = rootAgent(session.agents)
  const compacted = new Set(root?.compactions.map((mark) => mark.beforeTurnId) ?? [])
  // Numbered before the reverse, so the ordinal counts from the oldest turn while the list draws the
  // newest first.
  const turns = (root?.turns ?? [])
    .map((turn, index) => timelineTurn(turn, { compacted, ordinal: index + 1, nowMs }))
    .reverse()
  return {
    plan: sessionPlan(session),
    subagents: subagentGroup(session),
    turns,
    delegated: spawnedItems(session),
    own: turns.flatMap((turn) =>
      turn.steps.map((step): ActivityItem => ({ key: step.key, kind: 'step', step })),
    ),
  }
}
