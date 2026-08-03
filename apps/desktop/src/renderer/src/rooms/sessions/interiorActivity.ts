import type {
  FeedRow,
  SessionView,
  StopReason,
  ToolCall,
  ToolCallKind,
  ToolCallStatus,
  Turn,
} from '@shared'
import { rootAgent, turnFeedRows } from '@shared'
import { type ActivityDot, STEP_STATES } from './activityStates'
import {
  type SubagentGroupModel,
  subagentGroup,
  subagentRow,
  subagentsOf,
  toolCallsOf,
} from './interiorSubagents'
import { clockTime, duration } from './sessionClock'
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
  /** The wall-clock time the agent made the call, `14:03`, or `null` where the record carried none.
   * A time rather than an age: a turn's calls land seconds apart, so ages would read identically
   * down the whole list and tell you nothing about the order of the work. */
  at: string | null
  /** How long the call took, or how long it has been running. `null` until it has a start to
   * measure from. */
  took: string | null
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
  steps: readonly ToolStepModel[]
  /** A compaction marker sits in FRONT of this turn, so condensed history reads as continuous. */
  compactedBefore: boolean
}

/** One selectable thing, in the order the master list draws it and the detail feed concatenates it:
 * every subagent first, then this session's own turns. It carries its own detail, so the two panes
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
  | {
      key: string
      kind: 'turn'
      ordinal: number
      stopReason: StopReason | null
      /** The exchange as prose, derived once in `@shared` — what the agent was asked, what it
       * thought, and what it said, in the order it happened. */
      rows: readonly FeedRow[]
    }

export interface ActivityModel {
  /** The session's own live to-do list, or `null` where the CLI reported none. Session-scoped, so ONE
   * tracker is drawn for the surface rather than one inside every turn card. */
  plan: PlanProgressModel | null
  /** `null` where the session spawned none: there is no group to collapse, so none is drawn. */
  subagents: SubagentGroupModel | null
  /** Newest turn first — the open one leads, past turns fold behind it. */
  turns: readonly TimelineTurnModel[]
  /** The items split by WHOSE work they are, in feed order: every delegate's first, then this
   * session's own turns. The split is domain-meaningful, not a rendering convenience — a
   * subagent's work and the root Agent's are different agents', and a feed that concatenates them
   * behind identical seams reads as one timeline. The surface heads and indents by this, so nothing
   * downstream has to re-derive whose work it is looking at.
   *
   * `own` runs OLDEST FIRST, unlike `turns` above: this is the pane you read, and prose only reads
   * downward — a paragraph answers what came before it. The navigation list stays newest-first
   * until issue 319 reconciles the two panes; the keys match either way, so the highlight still tracks. */
  delegated: readonly ActivityItem[]
  own: readonly ActivityItem[]
}

function toolStep(call: ToolCall, nowMs: number | null): ToolStepModel {
  return {
    key: `step:${call.id}`,
    name: call.name,
    kind: call.kind,
    target: call.target,
    status: call.status,
    dot: STEP_STATES[call.status].dot,
    at: clockTime(call.atMs),
    took: duration(call.atMs, call.endedAtMs, nowMs),
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
    steps: turn.toolCalls.map((call) => toolStep(call, nowMs)),
    compactedBefore: compacted.has(turn.id),
  }
}

function spawnedItems(session: SessionView, nowMs: number | null): ActivityItem[] {
  return subagentsOf(session).map((agent) => {
    const row = subagentRow(agent, nowMs)
    return {
      key: row.key,
      kind: 'subagent',
      subagent: row,
      group: agent.group ?? null,
      events: toolCallsOf(agent).map((call) => toolStep(call, nowMs)),
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
  // The navigation row and the feed section for one turn are built in ONE pass, from one Turn: the
  // key and the ordinal they share are then a single derivation rather than two that must agree.
  const chronological = (root?.turns ?? []).map((turn, index) => {
    const model = timelineTurn(turn, { compacted, ordinal: index + 1, nowMs })
    return { model, item: ownItem(model, turn) }
  })
  return {
    plan: sessionPlan(session),
    subagents: subagentGroup(session, nowMs),
    turns: chronological.map(({ model }) => model).reverse(),
    delegated: spawnedItems(session, nowMs),
    own: chronological.map(({ item }) => item),
  }
}

/** One section per Turn, holding that turn's rows. The section is the turn because the turn is what
 * a prompt opens and a stop reason closes — a feed cut anywhere else would put a paragraph under a
 * heading that did not cause it. */
function ownItem(model: TimelineTurnModel, turn: Turn): ActivityItem {
  return {
    key: model.key,
    kind: 'turn',
    ordinal: model.ordinal,
    stopReason: model.stopReason,
    rows: turnFeedRows(turn),
  }
}
