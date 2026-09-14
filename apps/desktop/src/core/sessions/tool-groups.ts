import type { SessionFeedRow } from './models'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

// Everything a tool kind needs for grouping: where its content routes once opened, the words its
// count reads with, and where it falls in a mixed summary (a command count leads, since it is
// the kind a group exists to read inline; the rest follow in the order below). One table, so
// adding a kind is one new entry rather than four tables kept in lockstep.
const KIND_PRESENTATION: Record<
  ToolRow['kind'],
  { route: 'inline' | 'evidence'; verb: string; noun: string }
> = {
  command: { route: 'inline', verb: 'ran', noun: 'command' },
  edited: { route: 'evidence', verb: 'edited', noun: 'file' },
  created: { route: 'evidence', verb: 'created', noun: 'file' },
  read: { route: 'evidence', verb: 'read', noun: 'file' },
  tool: { route: 'evidence', verb: 'called', noun: 'tool' },
}
const KIND_ORDER = Object.keys(KIND_PRESENTATION) as ToolRow['kind'][]

// Where a group routes each call's content once opened: inline, as a labelled code block (a
// command's own text), or to the evidence panel, unchanged from today. The one place a future
// tool kind's routing is decided, so adding a kind never touches the grouping logic below.
export const TOOL_CONTENT_ROUTE: Record<ToolRow['kind'], 'inline' | 'evidence'> =
  Object.fromEntries(KIND_ORDER.map((kind) => [kind, KIND_PRESENTATION[kind].route])) as Record<
    ToolRow['kind'],
    'inline' | 'evidence'
  >

function countPhrase(kind: ToolRow['kind'], count: number, leading: boolean) {
  const { verb, noun } = KIND_PRESENTATION[kind]
  const capitalized = leading ? `${verb[0]?.toUpperCase()}${verb.slice(1)}` : verb
  return count === 1 ? `${capitalized} a ${noun}` : `${capitalized} ${count} ${noun}s`
}

function toolGroupLabel(calls: ToolRow[]) {
  const counts = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0])) as Record<
    ToolRow['kind'],
    number
  >
  for (const call of calls) counts[call.kind] += 1
  const kinds = KIND_ORDER.filter((kind) => counts[kind] > 0)
  return kinds.map((kind, index) => countPhrase(kind, counts[kind], index === 0)).join(', ')
}

// Every consecutive run of tool calls becomes one group, a lone call included: the same
// inline-or-evidence-panel routing rule then applies whether the group holds one call or many,
// so rendering never special-cases the one-call run.
export function groupToolRuns(rows: SessionFeedRow[]): SessionFeedRow[] {
  const grouped: SessionFeedRow[] = []
  for (let index = 0; index < rows.length; ) {
    const row = rows[index]
    if (row?.shape !== 'tool') {
      if (row !== undefined) grouped.push(row)
      index += 1
      continue
    }
    const calls: ToolRow[] = []
    while (rows[index]?.shape === 'tool') calls.push(rows[index++] as ToolRow)
    grouped.push({
      shape: 'tool-group',
      id: `tool-group:${calls.map(({ id }) => id).join(':')}`,
      label: toolGroupLabel(calls),
      calls,
    })
  }
  return grouped
}
