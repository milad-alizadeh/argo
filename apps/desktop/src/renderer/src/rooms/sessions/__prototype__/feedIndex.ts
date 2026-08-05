import type { FeedRow } from '@shared'
import type { ActivityItem, ActivityModel, TimelineTurnModel } from '../interiorActivity'

// PROTOTYPE. `ActivityModel` hands the surface a nav list (`turns`) and a feed (`own`) as two arrays
// keyed the same — which is the shape the current two-pane surface wants. Every variant here wants
// them JOINED: one chapter carrying both what you scan it by and what you read in it.

/** One chapter of the feed: the turn's scannable facts and its prose rows, together. */
export interface Chapter extends TimelineTurnModel {
  rows: readonly FeedRow[]
  /** The delegates this turn spawned, so a fanout can render where it happened rather than in a
   * standing group at the top of the surface. */
  delegates: readonly Extract<ActivityItem, { kind: 'subagent' }>[]
}

const isSubagent = (item: ActivityItem): item is Extract<ActivityItem, { kind: 'subagent' }> =>
  item.kind === 'subagent'

const rowsOf = (item: ActivityItem | undefined): readonly FeedRow[] =>
  item?.kind === 'turn' ? item.rows : []

/** The turn that spawned a delegate is not in the record — so the prototype attributes every
 * delegate to the turn holding a `delegate` call, which the fixture makes exactly one of. */
function spawnerKey(turns: readonly TimelineTurnModel[]): string | null {
  const turn = turns.find((candidate) => candidate.steps.some((step) => step.kind === 'delegate'))
  return turn?.key ?? null
}

export function chapters(activity: ActivityModel): Chapter[] {
  const owned = new Map(activity.own.map((item) => [item.key, item]))
  const spawner = spawnerKey(activity.turns)
  const delegates = activity.delegated.filter(isSubagent)
  return activity.turns.map((turn) => ({
    ...turn,
    rows: rowsOf(owned.get(turn.key)),
    delegates: turn.key === spawner ? delegates : [],
  }))
}

/** The one-word state a chapter is scanned by. Open turns read `running`; a stop reason reads as
 * itself, `unknown` included — the tier rule, kept even in a prototype. */
export const chapterWord = (turn: TimelineTurnModel): string =>
  turn.open ? 'running' : (turn.stopReason ?? 'unknown')

/** What a chapter is called in a list: its prompt, or its number where the record carried none. */
export const chapterTitle = (turn: TimelineTurnModel): string =>
  turn.promptLine ?? `turn ${turn.ordinal}`

/** How many rows in the chapter changed a file — the count a scannable index actually wants, since
 * "12 rows" says nothing and "2 edits" says whether to look. */
export const editCount = (chapter: Chapter): number =>
  chapter.rows.filter((row) => row.kind === 'mutation').length
