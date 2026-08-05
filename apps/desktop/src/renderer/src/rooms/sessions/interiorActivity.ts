import type { Agent, FeedRow, SessionView, StopReason, ToolCallStatus, ToolRowStep } from '@shared'
import { openTurn, rootAgent, turnFeed } from '@shared'
import { type ActivityDot, STEP_STATES, SUBAGENT_STATES } from './activityStates'
import {
  type SubagentGroupModel,
  subagentGroup,
  subagentRow,
  subagentsOf,
} from './interiorSubagents'
import { clockTime, duration } from './sessionClock'
import { type PlanProgressModel, sessionPlan } from './sessionPlan'

// The Activity surface's derivation: ONE displayed Agent, its feed, and the navigation list over the
// same rows. Built once so the two panes cannot fall out of step.
//
// One agent at a time, not a concatenation of several (issue 319): chronology, a single live edge and
// one virtualised container are only definable within one agent, and a feed that ran a delegate's work
// ahead of the session's own read as one timeline that never happened.

export interface ToolStepModel {
  /** The FEED ROW's key, not the call's: this entry names a row, and clicking it scrolls to that row's
   * anchor. A folded run of twelve reads is therefore one entry pointing at one anchor. */
  key: string
  /** The host's own tool name for a single call, Argo's tally (`read 3 · searched 1`) for a fold. */
  name: string
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
  /** The opening line of the prompt that caused this turn, verbatim — what the exchange is ABOUT,
   * which the ordinal cannot say. `null` where the record carried no prompt (a chain resumed
   * mid-turn): an absent prompt is an absent fact, and the card falls back to its number rather
   * than to a title Argo wrote. */
  promptLine: string | null
  /** Open: no stop reason observed yet, which is the signal the session is still working. */
  open: boolean
  /** `unknown` is rendered as itself — a guessed reason would be a fabricated fact. */
  stopReason: StopReason | null
  /** One per FOLDED tool row of this turn's feed, in feed order. */
  steps: readonly ToolStepModel[]
  /** A compaction marker sits in FRONT of this turn, so condensed history reads as continuous. */
  compactedBefore: boolean
}

/** One section of the feed and the navigation card over it — one Turn, seen from both panes.
 *
 * The section is the turn because the turn is what a prompt opens and a stop reason closes: a feed cut
 * anywhere else would put a paragraph under a heading that did not cause it. The section has no head —
 * the prompt row IS the seam, being the one row in the feed that is not the agent's voice, and the
 * turn's number and state word are the nav card's to carry. */
export interface FeedSectionModel {
  key: string
  turn: TimelineTurnModel
  /** The exchange as prose, derived once in `@shared` — what the agent was asked, what it thought,
   * what it said and what it changed, in the order it happened. */
  rows: readonly FeedRow[]
}

/** The head the detail pane wears when it is showing a DELEGATE's feed: whose work you are reading,
 * its one state word, and the line of what kind of thing it is. `null` at the root, because a surface
 * does not announce itself inside itself. */
export interface AgentHeadModel {
  name: string | null
  word: string
  /** Assembled from what was observed and nothing else — an absent part drops out. */
  meta: readonly string[]
}

/** Which agent's feed the pane is showing, and what the pane needs to say about it. */
export interface DisplayedAgentModel {
  id: string
  head: AgentHeadModel | null
  /** Where the explicit way back leads, named. `null` at the root, where there is nowhere to go. */
  parent: { id: string; label: string } | null
  /** The displayed agent is still working, so its feed follows its own live edge. A finished one is a
   * document you read rather than a stream you watch, and nothing scrolls under you. */
  live: boolean
}

export interface ActivityModel {
  /** Whose feed this is. Follow, scroll-spy and virtualisation are all scoped to it. */
  agent: DisplayedAgentModel
  /** The session's own live to-do list, or `null` where the CLI reported none. Session-scoped, so ONE
   * tracker is drawn for the surface rather than one inside every turn card. */
  plan: PlanProgressModel | null
  /** The DISPLAYED agent's delegates, or `null` where it spawned none. Selecting one replaces the
   * pane with its feed, so the group is a switch between agents rather than a jump within one. */
  subagents: SubagentGroupModel | null
  /** Oldest first, so the live turn is at the BOTTOM — a session reads the way a chat does, and the
   * place new work appears is the place you are already looking. Prose only reads downward: a
   * paragraph answers the tool run above it, so a navigation list ordered against its own feed would
   * make the highlight travel backwards as the reader scrolls. Past turns fold in place. */
  sections: readonly FeedSectionModel[]
}

/**
 * Every anchor of the displayed agent's feed, in reading order: each turn's section, then each of its
 * folded tool rows.
 *
 * The nav list and the feed are both drawn from `sections`, so this is what makes their parity an
 * ASSERTION rather than a comparison of two components — and it is the signature the scroll-spy
 * re-measures on, since a changed anchor list is a changed set of places to land.
 */
export function anchorKeys(sections: readonly FeedSectionModel[]): string[] {
  return sections.flatMap((section) => [section.key, ...section.turn.steps.map((step) => step.key)])
}

function toolStep(step: ToolRowStep, nowMs: number | null): ToolStepModel {
  return {
    key: step.key,
    name: step.name,
    target: step.target,
    status: step.status,
    dot: STEP_STATES[step.status].dot,
    at: clockTime(step.atMs),
    took: duration(step.atMs, step.endedAtMs, nowMs),
  }
}

/** The title reading of a verbatim prompt: its first non-blank line, kept word for word. A line
 * rather than a summary, because summarising a DERIVED fact is writing one — the card gives the
 * prompt one line of width and the rest stays in the feed, unaltered. */
function promptLine(prompt: string | null): string | null {
  const line = prompt?.trim().split('\n')[0] ?? ''
  return line === '' ? null : line
}

/** What every section of one build shares, so the per-turn call takes a turn and its context rather
 * than four positional arguments. */
interface SectionContext {
  compacted: ReadonlySet<string>
  ordinal: number
  nowMs: number | null
}

function feedSection(
  turn: Agent['turns'][number],
  { compacted, ordinal, nowMs }: SectionContext,
): FeedSectionModel {
  const compactedBefore = compacted.has(turn.id)
  const { rows, steps } = turnFeed(turn, { compactedBefore })
  const key = `turn:${turn.id}`
  return {
    key,
    rows,
    turn: {
      key,
      ordinal,
      promptLine: promptLine(turn.prompt),
      open: turn.stopReason === null,
      stopReason: turn.stopReason,
      steps: steps.map((step) => toolStep(step, nowMs)),
      compactedBefore,
    },
  }
}

/** The head for a delegate's feed, read off the same row model the navigation list draws — so the
 * pane and the row that led you to it cannot name one subagent two ways. */
function agentHead(agent: Agent, nowMs: number | null): AgentHeadModel {
  const row = subagentRow(agent, nowMs)
  return {
    name: row.name,
    word: SUBAGENT_STATES[row.status].word,
    meta: [
      'subagent',
      agent.group ?? null,
      row.took,
      row.tokens === null ? null : `${row.tokens} tokens`,
      row.target,
    ].filter((part): part is string => part !== null && part !== ''),
  }
}

/** Which agent the pane is showing: the one asked for, or the root when that id names nothing the
 * session holds — a selection that outlived its agent falls back rather than emptying the surface. */
function displayed(session: SessionView, agentId: string | null): Agent | null {
  const asked = agentId === null ? null : session.agents.find((agent) => agent.id === agentId)
  return asked ?? rootAgent(session.agents) ?? null
}

/** Where the way back leads, named by the agent it returns to. The root is named `the session` rather
 * than by its id: that agent IS the session, and its id is not a thing a reader has ever seen. */
function backTo(session: SessionView, agent: Agent): DisplayedAgentModel['parent'] {
  if (agent.parentId === null) return null
  const parent = session.agents.find((candidate) => candidate.id === agent.parentId)
  if (parent === undefined) return null
  return {
    id: parent.id,
    label: parent.parentId === null ? 'the session' : (parent.label ?? parent.id),
  }
}

/**
 * The Activity surface's whole view-model, built from ONE agent of the session's tree.
 *
 * An unparseable transcript yields no root, which renders as an empty surface rather than an
 * error: observation failure is not work failure (`cockpit-failure-states-spec.md` §8).
 */
export function buildActivity(
  session: SessionView,
  {
    nowMs = null,
    agentId = null,
  }: {
    /** Wall clock, injected so the derivation stays pure. */
    nowMs?: number | null
    /** Whose feed to show. `null` is the root Agent — the default the pane opens on. */
    agentId?: string | null
  } = {},
): ActivityModel {
  const agent = displayed(session, agentId)
  const compacted = new Set(agent?.compactions.map((mark) => mark.beforeTurnId) ?? [])
  return {
    agent: {
      id: agent?.id ?? '',
      head: agent === null || agent.parentId === null ? null : agentHead(agent, nowMs),
      parent: agent === null ? null : backTo(session, agent),
      live: agent !== null && openTurn(agent) !== null,
    },
    plan: sessionPlan(session),
    subagents: subagentGroup(subagentsOf(session, agent?.id ?? null), nowMs),
    sections: (agent?.turns ?? []).map((turn, index) =>
      feedSection(turn, { compacted, ordinal: index + 1, nowMs }),
    ),
  }
}
