import type {
  DiffResult,
  OutputResult,
  ToolCall,
  ToolCallKind,
  ToolCallStatus,
  Turn,
} from './runtimeTree'

// How one Turn's tool calls read: the loud/quiet policy of the Activity feed, decided here so that
// every part of it is falsifiable without mounting anything.
//
// ONE rule organises the whole thing: mutations and failures are LOUD, observation is QUIET. A
// mutation is irreversible state change and must be unmissable; a read is provenance and deserves
// one line. What makes it hold is the BREAK — a fold ends at the next loud row — which is what makes
// "edited a file, ran a command, read a file" structurally impossible rather than merely discouraged.

/** A change the agent made to a file, carrying its own diff. Loud and un-foldable by construction:
 * irreversible state change is never something you have to go looking for.
 *
 * `diff` is `null` for a mutation whose result never arrived (still running, or a turn that was
 * interrupted) and for one whose patch the record did not carry — the row says so rather than
 * standing in for a change it cannot show. `output` is what it printed instead, which for a FAILED
 * change is the only thing that says why it did not land. */
export interface MutationRow {
  kind: 'mutation'
  key: string
  /** The file the call named, `null` where it named none. */
  path: string | null
  status: ToolCallStatus
  diff: DiffResult | null
  output: OutputResult | null
}

/** One call loud enough for a row of its own: a command, always, and a failure of any other kind.
 *
 * A command earns a row because the line it ran is the fact worth reading, and its output is one
 * click away. A failure earns one because the thing that went wrong should be the thing you see. */
export interface CallRow {
  kind: 'call'
  key: string
  /** What the call did, CLI-agnostic. The host's own tool name travels beside it in `name`, so
   * neither one is renamed away by the other. */
  callKind: ToolCallKind
  name: string
  /** The command line for a command, the file or pattern for the rest. `null` where the record named
   * none. */
  target: string | null
  status: ToolCallStatus
  output: OutputResult | null
  /** Whether the output is shown without asking. The DERIVATION's decision, not the component's: a
   * failure opens, a success stays closed, and both are a test rather than a screenshot. */
  open: boolean
}

/** One kind's tally inside a folded run, in Argo's own vocabulary. A count rather than a sentence
 * because a sentence degrades into "read a file, read a file, read a file" at thirty calls. */
export interface QuietCount {
  word: string
  count: number
}

/** A run of consecutive observation, folded to one line. */
export interface QuietRow {
  kind: 'quiet'
  key: string
  counts: readonly QuietCount[]
}

export type ToolRow = MutationRow | CallRow | QuietRow

/** How many rows a run of quiet work is worth. */
type CallRole = 'none' | 'mutation' | 'loud' | 'quiet'

/**
 * Which row one call is worth.
 *
 * `none` is not a silent drop: a delegate's work is the child's and the Subagents section owns it,
 * and a plan call's row is the Turn's one plan row. Everything else lands somewhere.
 */
function roleOf(call: ToolCall): CallRole {
  if (call.kind === 'delegate') return 'none'
  if (call.kind === 'edit') return 'mutation'
  // Whatever the call was FOR, a failure is a failure first.
  if (call.status === 'failed') return 'loud'
  if (call.kind === 'plan') return 'none'
  if (call.kind === 'execute') return 'loud'
  return 'quiet'
}

const isRunning = (status: ToolCallStatus): boolean =>
  status === 'pending' || status === 'in_progress'

const outputOf = (call: ToolCall): OutputResult | null =>
  call.result?.kind === 'output' ? call.result : null

function mutationRow(call: ToolCall): MutationRow {
  return {
    kind: 'mutation',
    key: `mutation:${call.id}`,
    path: call.target,
    status: call.status,
    // Shown once the call has come BACK, whether it came back well or badly: a failure that still
    // reported what it changed is a change that happened. A running call whose record already carried
    // a patch would be a finished row wearing a live state, which is the one direction to refuse.
    diff: isRunning(call.status) || call.result?.kind !== 'diff' ? null : call.result,
    output: outputOf(call),
  }
}

function callRow(call: ToolCall): CallRow {
  return {
    kind: 'call',
    key: `call:${call.id}`,
    callKind: call.kind,
    name: call.name,
    target: call.target,
    status: call.status,
    output: outputOf(call),
    open: call.status === 'failed',
  }
}

/** The word a kind wears in a fold. The kind's own word where it already reads as one, so only the
 * two that would read as nouns are spelled out. */
const QUIET_WORD: Partial<Record<ToolCallKind, string>> = { search: 'searched', fetch: 'fetched' }

/** The tallies of one run, in the order the kinds first appeared — which is the order the work
 * happened in, and the only order that does not need explaining. */
function quietRow(run: readonly ToolCall[]): QuietRow {
  const byKind = new Map<ToolCallKind, number>()
  for (const call of run) byKind.set(call.kind, (byKind.get(call.kind) ?? 0) + 1)
  return {
    kind: 'quiet',
    key: `quiet:${run[0]?.id ?? ''}`,
    counts: [...byKind].map(([kind, count]) => ({ word: QUIET_WORD[kind] ?? kind, count })),
  }
}

/** One stretch of calls, run-length folded. A call worth no row does not break a run either: there
 * is no row for the break to show, and the observation either side of it is still consecutive. */
function foldRun(calls: readonly ToolCall[]): ToolRow[] {
  const rows: ToolRow[] = []
  let run: ToolCall[] = []
  const breakRun = (): void => {
    if (run.length > 0) rows.push(quietRow(run))
    run = []
  }
  for (const call of calls) {
    const role = roleOf(call)
    if (role === 'quiet') run.push(call)
    if (role === 'mutation' || role === 'loud') {
      breakRun()
      rows.push(role === 'mutation' ? mutationRow(call) : callRow(call))
    }
  }
  breakRun()
  return rows
}

/**
 * Every call of a turn, grouped by the point in its narrative it was made — after that many prose
 * parts had been said, and before the next one was.
 *
 * The grouping is what breaks a fold at a prose row: a run is folded WITHIN one bucket, so the reads
 * that preceded a paragraph stay welded to it and never absorb the work that followed it.
 */
export function toolRowsByProseIndex(turn: Turn): Map<number, ToolRow[]> {
  const buckets = new Map<number, ToolCall[]>()
  for (const call of turn.toolCalls) {
    // Clamped to the end of the prose so a call that ran past it lands in the trailing bucket. A
    // call dropped for sitting at an index nothing reads is the exact loss this surface prevents.
    const index = Math.min(call.proseIndex, turn.prose.length)
    buckets.set(index, [...(buckets.get(index) ?? []), call])
  }
  return new Map([...buckets].map(([index, calls]) => [index, foldRun(calls)]))
}
