import type { Agent, Plan, Prose, Turn } from '../runtimeTree'
import { type ToolRow, toolRowsByProseIndex } from './calls'

// THE feed derivation: one Agent's runtime tree in, one ordered list of rows out. Every reading rule
// the Activity feed has lives here rather than in a component, so each one is falsifiable without
// mounting anything — and so the navigation list and the feed cannot disagree about what a row is.
//
// This file assembles a TURN; how its tool calls read (the loud/quiet policy and the fold) is
// `feedCalls.ts`.
//
// One AGENT, not one session: a subagent's work is a different agent's, and a feed that concatenates
// several reads as one timeline that never happened (issue 313).

/** One row of the feed, in the order it is read. Media joins this union in a later ticket. */
export type FeedRow =
  | { kind: 'prompt'; key: string; text: string; turnId: string }
  | { kind: 'message'; key: string; markdown: string }
  /** Reasoning, collapsed to a line by default: available when a conclusion surprises you, ignorable
   * otherwise. `collapsed` is the derivation's decision rather than the component's, which is what
   * keeps "thoughts open closed" a test rather than a screenshot. */
  | { kind: 'thought'; key: string; markdown: string; collapsed: true }
  /** The agent's live to-do list as it stood, ONE row per turn however many times that turn revised
   * it — the Turn carries the snapshot in force while it ran (ADR-0020), so ten ticks update this row
   * rather than adding ten. */
  | { kind: 'plan'; key: string; plan: Plan }
  /** The seam where history was condensed, in front of the Turn it precedes: it is visible why
   * earlier context is no longer in the agent's head. */
  | { kind: 'compaction'; key: string }
  | ToolRow

const proseRow = (turn: Turn, prose: Prose, index: number): FeedRow => {
  const key = `prose:${turn.id}:${index}`
  return prose.kind === 'thought'
    ? { kind: 'thought', key, markdown: prose.markdown, collapsed: true }
    : { kind: 'message', key, markdown: prose.markdown }
}

/** Where the plan row sits: at the point the plan was LAST revised, which is the only moment in the
 * narrative it says anything about.
 *
 * A snapshot with no plan call to place it against falls to the END of the turn. That is the honest
 * position for it rather than a guess at where it changed — but it is also why `turn.plan` is set
 * from the plan CALL and not carried forward from the turn before: a snapshot merely inherited would
 * land a row at the bottom of every turn, saying a revision happened where none did. */
function planIndex(turn: Turn): number {
  const revision = turn.toolCalls.findLast((call) => call.kind === 'plan')
  return Math.min(revision?.proseIndex ?? turn.prose.length, turn.prose.length)
}

/** Everything that sits BEFORE each prose part: that stretch's folded tool rows, and the plan row
 * where the plan was last revised. The plan lands last in its bucket — the work of that stretch, then
 * the list as it stood once that work was done. */
function rowsByProseIndex(turn: Turn): Map<number, FeedRow[]> {
  const byIndex = new Map<number, FeedRow[]>(toolRowsByProseIndex(turn))
  // An emptied list is not a plan: reading it as a snapshot would let a cleared plan stand in for
  // the last real one the session reported.
  if (turn.plan === null || turn.plan.entries.length === 0) return byIndex
  const index = planIndex(turn)
  const row: FeedRow = { kind: 'plan', key: `plan:${turn.id}`, plan: turn.plan }
  return byIndex.set(index, [...(byIndex.get(index) ?? []), row])
}

/** What sits at the seam in front of a Turn, which the Agent knows and the Turn does not. */
export interface TurnSeam {
  /** History was condensed in front of this Turn, so the feed draws the seam it was condensed at. */
  compactedBefore: boolean
}

/**
 * One turn's rows: the same derivation sliced at the seam a surface heads by, since a Turn is what a
 * prompt opens and a stop reason closes.
 *
 * A turn opens with the prompt that caused it, so the work beneath always has a stated reason. A
 * turn whose record carried no prompt (a chain resumed mid-turn) opens with none: an absent prompt
 * is an absent fact, and a row reading as "you asked for nothing" would be a fabricated one.
 *
 * The prompt row IS the seam between turns on this surface: it is the one row that is not the
 * agent's voice, so a reader scrolling the feed sees where each exchange began without a heading
 * repeating it an inch above.
 *
 * Tool rows are placed IN the prose sequence rather than appended after it, from the count of prose
 * parts each call was made after. Appending them would put every change the agent made below the
 * paragraph that explains it, and a feed read in an order that never happened explains nothing.
 */
export function turnFeedRows(turn: Turn, seam: TurnSeam = { compactedBefore: false }): FeedRow[] {
  const opening: FeedRow[] = seam.compactedBefore
    ? [{ kind: 'compaction', key: `compaction:${turn.id}` }]
    : []
  // A prompt of whitespace alone has nothing in it to read, and the seam it would draw is a blank
  // rail. Absent for the same reason an absent prompt is: there is no text to show verbatim.
  if (turn.prompt !== null && turn.prompt.trim() !== '') {
    opening.push({ kind: 'prompt', key: `prompt:${turn.id}`, text: turn.prompt, turnId: turn.id })
  }
  const before = rowsByProseIndex(turn)
  // A prose part with nothing in it is not a row. The parser already drops these, so this is the
  // second line rather than the first — but the rule belongs here too, because the row list is
  // what the surface renders and a blank row is a surface fact: a message with no words renders
  // as a gap, and a thought with none renders as a disclosure caret opening onto nothing. The
  // tool rows placed at that index still stand; only the empty prose goes.
  const narrative = turn.prose.flatMap((prose, index) => [
    ...(before.get(index) ?? []),
    ...(prose.markdown.trim() === '' ? [] : [proseRow(turn, prose, index)]),
  ])
  return [...opening, ...narrative, ...(before.get(turn.prose.length) ?? [])]
}

/**
 * The rows for one Agent, chronological and oldest first.
 *
 * Oldest first because prose only reads downward: a paragraph answers what came above it, and a
 * narrative read newest-first is not a narrative. Prose is carried VERBATIM through this function —
 * never trimmed, wrapped or summarized — because every word of it is a DERIVED fact read off an
 * external record (CONTEXT.md, honesty tier).
 */
export function feedRows(agent: Agent): FeedRow[] {
  const compacted = new Set(agent.compactions.map((mark) => mark.beforeTurnId))
  return agent.turns.flatMap((turn) =>
    turnFeedRows(turn, { compactedBefore: compacted.has(turn.id) }),
  )
}
