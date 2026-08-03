import type { Agent, Prose, Turn } from './runtimeTree'

// THE feed derivation: one Agent's runtime tree in, one ordered list of rows out. Every reading rule
// the Activity feed has lives here rather than in a component, so each one is falsifiable without
// mounting anything — and so the navigation list and the feed cannot disagree about what a row is.
//
// One AGENT, not one session: a subagent's work is a different agent's, and a feed that concatenates
// several reads as one timeline that never happened (issue 313).

/** One row of the feed, in the order it is read. Tool work, media and folding join this union in
 * later tickets; nothing here decides anything about them yet. */
export type FeedRow =
  | { kind: 'prompt'; key: string; text: string; turnId: string }
  | { kind: 'message'; key: string; markdown: string }
  /** Reasoning, collapsed to a line by default: available when a conclusion surprises you, ignorable
   * otherwise. `collapsed` is the derivation's decision rather than the component's, which is what
   * keeps "thoughts open closed" a test rather than a screenshot. */
  | { kind: 'thought'; key: string; markdown: string; collapsed: true }

const proseRow = (turn: Turn, prose: Prose, index: number): FeedRow => {
  const key = `prose:${turn.id}:${index}`
  return prose.kind === 'thought'
    ? { kind: 'thought', key, markdown: prose.markdown, collapsed: true }
    : { kind: 'message', key, markdown: prose.markdown }
}

/**
 * One turn's rows: the same derivation sliced at the seam a surface heads by, since a Turn is what a
 * prompt opens and a stop reason closes.
 *
 * A turn opens with the prompt that caused it, so the work beneath always has a stated reason. A
 * turn whose record carried no prompt (a chain resumed mid-turn) opens with none: an absent prompt
 * is an absent fact, and a row reading as "you asked for nothing" would be a fabricated one.
 */
export function turnFeedRows(turn: Turn): FeedRow[] {
  const opening: FeedRow[] =
    turn.prompt === null
      ? []
      : [{ kind: 'prompt', key: `prompt:${turn.id}`, text: turn.prompt, turnId: turn.id }]
  return [...opening, ...turn.prose.map((prose, index) => proseRow(turn, prose, index))]
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
  return agent.turns.flatMap(turnFeedRows)
}
