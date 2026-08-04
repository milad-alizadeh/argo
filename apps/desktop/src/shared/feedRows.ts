import type { Agent, DiffResult, Prose, ToolCall, ToolCallStatus, Turn } from './runtimeTree'

// THE feed derivation: one Agent's runtime tree in, one ordered list of rows out. Every reading rule
// the Activity feed has lives here rather than in a component, so each one is falsifiable without
// mounting anything — and so the navigation list and the feed cannot disagree about what a row is.
//
// One AGENT, not one session: a subagent's work is a different agent's, and a feed that concatenates
// several reads as one timeline that never happened (issue 313).

/** One row of the feed, in the order it is read. Commands, media and folding join this union in
 * later tickets; nothing here decides anything about them yet. */
export type FeedRow =
  | { kind: 'prompt'; key: string; text: string; turnId: string }
  | { kind: 'message'; key: string; markdown: string }
  /** Reasoning, collapsed to a line by default: available when a conclusion surprises you, ignorable
   * otherwise. `collapsed` is the derivation's decision rather than the component's, which is what
   * keeps "thoughts open closed" a test rather than a screenshot. */
  | { kind: 'thought'; key: string; markdown: string; collapsed: true }
  /** A change the agent made to a file, carrying its own diff. Loud and un-foldable by
   * construction: irreversible state change is never something you have to go looking for.
   *
   * `diff` is `null` for a mutation whose result never arrived (still running, or a turn that was
   * interrupted) and for one whose patch the record did not carry — the row says so rather than
   * standing in for a change it cannot show. */
  | {
      kind: 'mutation'
      key: string
      /** The file the call named, `null` where it named none. */
      path: string | null
      status: ToolCallStatus
      diff: DiffResult | null
    }

const isRunning = (status: ToolCallStatus): boolean =>
  status === 'pending' || status === 'in_progress'

const mutationRow = (call: ToolCall): FeedRow => ({
  kind: 'mutation',
  key: `mutation:${call.id}`,
  path: call.target,
  status: call.status,
  // Shown once the call has come BACK, whether it came back well or badly: a failure that still
  // reported what it changed is a change that happened. A running call whose record already carried
  // a patch would be a finished row wearing a live state, which is the one direction to refuse.
  diff: isRunning(call.status) || call.result?.kind !== 'diff' ? null : call.result,
})

/** Every mutation of a turn, grouped by the point in its narrative the call was made — after that
 * many prose parts had been said, and before the next one was. Grouped in ONE pass rather than
 * re-filtered per paragraph: a long turn's calls and prose both run to the hundreds. */
function mutationsByProseIndex(turn: Turn): Map<number, FeedRow[]> {
  const grouped = new Map<number, FeedRow[]>()
  for (const call of turn.toolCalls) {
    if (call.kind !== 'edit') continue
    // Clamped to the end of the prose so a call that ran past it lands in the trailing bucket. A
    // mutation dropped for sitting at an index nothing reads is the exact loss this ticket fixes.
    const index = Math.min(call.proseIndex, turn.prose.length)
    const at = grouped.get(index) ?? []
    at.push(mutationRow(call))
    grouped.set(index, at)
  }
  return grouped
}

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
 *
 * The prompt row IS the seam between turns on this surface: it is the one row that is not the
 * agent's voice, so a reader scrolling the feed sees where each exchange began without a heading
 * repeating it an inch above.
 *
 * Mutations are placed IN the prose sequence rather than appended after it, from the count of prose
 * parts each call was made after. Appending them would put every change the agent made below the
 * paragraph that explains it, and a feed read in an order that never happened explains nothing.
 */
export function turnFeedRows(turn: Turn): FeedRow[] {
  // A prompt of whitespace alone has nothing in it to read, and the seam it would draw is a blank
  // rail. Absent for the same reason an absent prompt is: there is no text to show verbatim.
  const opening: FeedRow[] =
    turn.prompt === null || turn.prompt.trim() === ''
      ? []
      : [{ kind: 'prompt', key: `prompt:${turn.id}`, text: turn.prompt, turnId: turn.id }]
  const mutations = mutationsByProseIndex(turn)
  const narrative = turn.prose.flatMap((prose, index) => [
    ...(mutations.get(index) ?? []),
    proseRow(turn, prose, index),
  ])
  return [...opening, ...narrative, ...(mutations.get(turn.prose.length) ?? [])]
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
