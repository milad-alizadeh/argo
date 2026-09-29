import type { FeedRowEntry } from './feed-row-entries'
import type { LiveActivity, SessionFeedRow } from './feed-rows'
import { withHeadline } from './tool-groups'

type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>

// The live thought reads once, as the trailing row, so the group it follows lets it go.
function withoutThought(group: ToolGroupRow, text: string): ToolGroupRow {
  const thoughts = group.thoughts ?? []
  return thoughts.at(-1)?.text.trim() === text
    ? { ...group, thoughts: thoughts.slice(0, -1) }
    : group
}

// The tail group of the current Turn, or null when the Turn has none.
function currentTurnTailGroup(rows: readonly SessionFeedRow[]): ToolGroupRow | null {
  const last = rows.at(-1)
  if (last?.shape !== 'tool-group') return null
  const turnStart = rows.findLastIndex((row) => row.shape === 'prose' && row.role === 'user')
  return rows.length - 1 > turnStart ? last : null
}

// While the Turn runs, its one activity draws once: a call titles the tail group, and a thought
// is the trailing row. A settled Turn draws neither, so no live row is left behind.
function withActivity(
  rows: readonly SessionFeedRow[],
  activity: LiveActivity,
): readonly SessionFeedRow[] {
  if (rows.at(-1)?.shape === 'thought') return rows
  const tailGroup = currentTurnTailGroup(rows)
  if (activity.kind !== 'thought')
    return tailGroup === null ? rows : [...rows.slice(0, -1), withHeadline(tailGroup, activity)]
  const settled =
    tailGroup === null ? rows : [...rows.slice(0, -1), withoutThought(tailGroup, activity.label)]
  return [...settled, { shape: 'thought', id: 'activity', text: activity.label }]
}

// The rows a Feed reading draws: its settled rows, and the current activity folded in while the
// Turn is still running. `running` is the Session's own liveness, the fact the Roster reads too.
export function feedReadingRows(
  entries: readonly FeedRowEntry[],
  { running }: { running: boolean },
): readonly SessionFeedRow[] {
  const rows: SessionFeedRow[] = []
  let activity: LiveActivity | null = null
  for (const { row } of entries) {
    if (row.shape === 'activity') activity = row.activity
    else rows.push(row)
  }
  return activity === null || !running ? rows : withActivity(rows, activity)
}
