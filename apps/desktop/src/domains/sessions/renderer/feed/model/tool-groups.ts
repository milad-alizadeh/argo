import type { LiveActivity } from '@/domains/sessions/api/feed/feed-rows'
import { fingerprint } from '@/domains/sessions/api/feed/fingerprint'
import type { SessionFeedRow } from '../../model/models'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

function toolGroupId(calls: ToolRow[]) {
  const firstCallId = calls[0]?.id ?? ''
  return `tool-group:${fingerprint(firstCallId)}`
}

// One tool-kind record owns its icon, route, group wording, and group order.
export const TOOL_KIND_PRESENTATION: Record<
  ToolRow['kind'],
  {
    icon: 'terminal' | 'search' | 'file' | 'wrench' | 'wand' | 'globe'
    route: 'inline' | 'evidence'
    verb: string
    noun: string
  }
> = {
  command: { icon: 'terminal', route: 'inline', verb: 'ran', noun: 'command' },
  edited: { icon: 'file', route: 'evidence', verb: 'edited', noun: 'file' },
  deleted: { icon: 'file', route: 'evidence', verb: 'deleted', noun: 'file' },
  created: { icon: 'file', route: 'evidence', verb: 'created', noun: 'file' },
  read: { icon: 'search', route: 'evidence', verb: 'read', noun: 'file' },
  tool: { icon: 'wrench', route: 'inline', verb: 'ran', noun: 'tool' },
  skill: { icon: 'wand', route: 'inline', verb: 'invoked', noun: 'skill' },
  searched: { icon: 'globe', route: 'inline', verb: 'searched', noun: 'the web' },
}
const KIND_ORDER = Object.keys(TOOL_KIND_PRESENTATION) as ToolRow['kind'][]

// A skill keeps its own line under its own name, so it neither joins a run
// nor folds into a count.
export function standsAlone(kind: ToolRow['kind']) {
  return kind === 'skill'
}

function countPhrase(kind: ToolRow['kind'], count: number, leading: boolean) {
  const { verb, noun } = TOOL_KIND_PRESENTATION[kind]
  const capitalized = leading ? `${verb[0]?.toUpperCase()}${verb.slice(1)}` : verb
  return count === 1 ? `${capitalized} a ${noun}` : `${capitalized} ${count} ${noun}s`
}

// An unclassified tool call or a web search reads to a person the same as a command: both are
// "the agent ran something". Folding them into the 'command' count keeps the summary to one
// phrase instead of a second clause that names an implementation detail nobody asked for.
function labelKind(kind: ToolRow['kind']): ToolRow['kind'] {
  return kind === 'tool' || kind === 'searched' ? 'command' : kind
}

function toolGroupLabel(calls: ToolRow[]) {
  const counts = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0])) as Record<
    ToolRow['kind'],
    number
  >
  for (const call of calls) counts[labelKind(call.kind)] += 1
  const kinds = KIND_ORDER.filter((kind) => labelKind(kind) === kind && counts[kind] > 0)
  return kinds.map((kind, index) => countPhrase(kind, counts[kind], index === 0)).join(', ')
}

// A caller supplies the ids that began immediately after a hidden transcript delivery. That
// delivery is not a Feed row, but it is still a real turn boundary: calls on either side must
// not acquire one summary merely because the delivery itself has nothing useful to render.
//
// The optional set keeps this renderer-facing helper useful for ordinary row lists while the
// transcript projectors retain the history information that disappears from those lists.
export function groupedRowIndexes(
  rows: SessionFeedRow[],
  breakBeforeIds: ReadonlySet<string> = new Set(),
): number[][] {
  const groups: number[][] = []
  for (let index = 0; index < rows.length; ) {
    const row = rows[index]
    if (row?.shape !== 'tool' || standsAlone(row.kind)) {
      groups.push([index])
      index += 1
      continue
    }
    const run: number[] = []
    let next = rows[index]
    while (
      next?.shape === 'thought' ||
      (next?.shape === 'tool' &&
        !standsAlone(next.kind) &&
        (run.length === 0 || !breakBeforeIds.has(next.id)))
    ) {
      run.push(index++)
      next = rows[index]
    }
    groups.push(run)
  }
  return groups
}

function toolGroup(calls: ToolRow[]): SessionFeedRow {
  return { shape: 'tool-group', id: toolGroupId(calls), label: toolGroupLabel(calls), calls }
}

type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>

function foldableGroup(row: SessionFeedRow | undefined): ToolGroupRow | null {
  return row?.shape === 'tool-group' &&
    row.thoughts === undefined &&
    !row.calls.some((call) => standsAlone(call.kind))
    ? row
    : null
}

// What the Feed draws once a thought between two runs has left it: neighbouring runs fold into
// one group, the running call included, and the group's title names what is running while its
// count waits inside. A skill keeps its own line, as in `groupedRowIndexes`.
export function foldSettledToolRuns(rows: SessionFeedRow[]): SessionFeedRow[] {
  const folded: SessionFeedRow[] = []
  for (const row of rows) {
    const previous = foldableGroup(folded.at(-1))
    const group = foldableGroup(row)
    // A row that folds into nothing keeps its identity: the scroller keys its rows on it.
    if (group === null || previous === null) {
      folded.push(row)
      continue
    }
    folded[folded.length - 1] = toolGroup([...previous.calls, ...group.calls])
  }
  return folded
}

// The running Turn's latest thought, when it lands after a run, titles that run's group: the
// Feed then has one shimmering line, the group's own, and the roster reads the same words.
export function withHeadline(row: SessionFeedRow, headline: LiveActivity): SessionFeedRow {
  return row.shape === 'tool-group' ? { ...row, headline } : row
}

function indexedToolGroup(rows: SessionFeedRow[], indexes: number[]): SessionFeedRow {
  const calls: ToolRow[] = []
  const thoughts: { id: string; text: string; afterCallIndex: number }[] = []
  for (const index of indexes) {
    const row = rows[index]
    if (row?.shape === 'tool') calls.push(row)
    if (row?.shape === 'thought')
      thoughts.push({ id: row.id, text: row.text, afterCallIndex: calls.length - 1 })
  }
  return { ...toolGroup(calls), ...(thoughts.length === 0 ? {} : { thoughts }) }
}

export function groupToolRuns(
  rows: SessionFeedRow[],
  breakBeforeIds: ReadonlySet<string> = new Set(),
): SessionFeedRow[] {
  const grouped: SessionFeedRow[] = []
  for (const indexes of groupedRowIndexes(rows, breakBeforeIds)) {
    const first = rows[indexes[0] ?? -1]
    if (first === undefined) continue
    if (first.shape !== 'tool') {
      grouped.push(first)
      continue
    }
    grouped.push(indexedToolGroup(rows, indexes))
  }
  return grouped
}
