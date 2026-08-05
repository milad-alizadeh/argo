import type { FeedRow, StopReason, ToolCall, ToolCallKind, ToolCallStatus, Turn } from '@shared'
import { turnFeedRows } from '@shared'
import { type ActivityDot, STEP_STATES } from './activityStates'
import { clockTime, duration } from './sessionClock'

// The timeline grain of the Activity derivation: one turn as a scannable model, and one turn as a
// CHAPTER — the same model joined to its prose rows. Chapters are the feed's unit: the sticky seam
// is drawn from the turn half, the body from the rows half, and building them as one object is what
// keeps the seam and the prose it heads from ever disagreeing.

export interface ToolStepModel {
  key: string
  name: string
  /** What the call did, CLI-agnostic — the word a step gutter reads. The host's own tool name
   * travels beside it in `name`, so neither one is renamed away. */
  kind: ToolCallKind
  target: string | null
  status: ToolCallStatus
  dot: ActivityDot
  /** The wall-clock time the agent made the call, `14:03`, or `null` where the record carried
   * none. */
  at: string | null
  /** How long the call took, or has been running. `null` until it has a start to measure from. */
  took: string | null
}

export interface TimelineTurnModel {
  key: string
  /** Which exchange of the session this is, counted from the OLDEST — a turn keeps its number for
   * as long as the session lives. */
  ordinal: number
  /** The opening line of the prompt that caused this turn, verbatim; `null` where the record
   * carried none (a chain resumed mid-turn). */
  promptLine: string | null
  /** Open: no stop reason observed yet — the signal the agent is still working. */
  open: boolean
  /** `unknown` is rendered as itself — a guessed reason would be a fabricated fact. */
  stopReason: StopReason | null
  steps: readonly ToolStepModel[]
  /** A compaction marker sits in FRONT of this turn, so condensed history reads as continuous. */
  compactedBefore: boolean
}

/** One chapter of a feed: the turn's scannable facts and its prose rows, together. */
export interface ChapterModel extends TimelineTurnModel {
  rows: readonly FeedRow[]
}

export function toolStep(call: ToolCall, nowMs: number | null): ToolStepModel {
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
export interface TimelineContext {
  compacted: ReadonlySet<string>
  ordinal: number
  nowMs: number | null
}

/** The title reading of a verbatim prompt: its first non-blank line, kept word for word. */
export function promptLine(prompt: string | null): string | null {
  const line = prompt?.trim().split('\n')[0] ?? ''
  return line === '' ? null : line
}

export function timelineTurn(
  turn: Turn,
  { compacted, ordinal, nowMs }: TimelineContext,
): TimelineTurnModel {
  return {
    key: `turn:${turn.id}`,
    ordinal,
    promptLine: promptLine(turn.prompt),
    open: turn.stopReason === null,
    stopReason: turn.stopReason,
    steps: turn.toolCalls.map((call) => toolStep(call, nowMs)),
    compactedBefore: compacted.has(turn.id),
  }
}

const NO_COMPACTIONS: ReadonlySet<string> = new Set()

/** A delegate's own feed, one chapter per turn — the SAME grammar as the session's, because a
 * subagent's feed is a feed like any other and earns no derivation of its own. Compactions are a
 * root-agent fact, so a delegate chapter never carries one. */
export const agentChapters = (turns: readonly Turn[], nowMs: number | null): ChapterModel[] =>
  turns.map((turn, index) => ({
    ...timelineTurn(turn, { compacted: NO_COMPACTIONS, ordinal: index + 1, nowMs }),
    rows: turnFeedRows(turn, { compactedBefore: false }),
  }))

/** What a chapter is called where one is named: its prompt, or its number where the record carried
 * no prompt — an absent fact falls back to a count, never to a title Argo wrote. */
export const chapterTitle = (turn: TimelineTurnModel): string =>
  turn.promptLine ?? `turn ${turn.ordinal}`
