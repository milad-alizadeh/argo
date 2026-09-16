import type { SessionFeedRow } from './models'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

// Group ids cross the Session IPC boundary, where identifiers are deliberately capped at 256
// characters. A run can hold many ordinary UUID-length tool calls, so joining every id makes a
// valid Feed fail its whole reply contract. These two independent 32-bit passes keep the id
// deterministic and bounded without depending on Node APIs (this module is also renderer-safe).
function groupFingerprint(value: string, seed: number) {
  let hash = seed
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function toolGroupId(calls: ToolRow[]) {
  const callIds = calls.map(({ id }) => id).join('\u001f')
  return `tool-group:${groupFingerprint(callIds, 0x811c9dc5)}${groupFingerprint(callIds, 0x9e3779b9)}`
}

// One tool-kind record owns its icon, route, group wording, and group order.
export const TOOL_KIND_PRESENTATION: Record<
  ToolRow['kind'],
  {
    icon: 'terminal' | 'search' | 'file' | 'wrench' | 'wand'
    route: 'inline' | 'evidence'
    verb: string
    noun: string
  }
> = {
  command: { icon: 'terminal', route: 'inline', verb: 'ran', noun: 'command' },
  edited: { icon: 'file', route: 'evidence', verb: 'edited', noun: 'file' },
  created: { icon: 'file', route: 'evidence', verb: 'created', noun: 'file' },
  read: { icon: 'search', route: 'evidence', verb: 'read', noun: 'file' },
  tool: { icon: 'wrench', route: 'inline', verb: 'called', noun: 'tool' },
  skill: { icon: 'wand', route: 'inline', verb: 'invoked', noun: 'skill' },
}
const KIND_ORDER = Object.keys(TOOL_KIND_PRESENTATION) as ToolRow['kind'][]

function countPhrase(kind: ToolRow['kind'], count: number, leading: boolean) {
  const { verb, noun } = TOOL_KIND_PRESENTATION[kind]
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
    // A skill invocation reads as its own line, never folded into a mixed "ran a command,
    // invoked a skill" summary alongside another kind, so it always starts (and ends) its own run.
    if (row?.shape !== 'tool' || row.kind === 'skill') {
      groups.push([index])
      index += 1
      continue
    }
    const run: number[] = []
    let next = rows[index]
    while (
      next?.shape === 'tool' &&
      next.kind !== 'skill' &&
      (run.length === 0 || !breakBeforeIds.has(next.id))
    ) {
      run.push(index++)
      next = rows[index]
    }
    groups.push(run)
  }
  return groups
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
    const calls = indexes
      .map((index) => rows[index])
      .filter((row): row is ToolRow => row?.shape === 'tool')
    grouped.push({
      shape: 'tool-group',
      id: toolGroupId(calls),
      label: toolGroupLabel(calls),
      calls,
    })
  }
  return grouped
}
