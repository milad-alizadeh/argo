import { type MediaRowModel, mediaRow, openMediaIds } from './feedMedia'
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
export interface MutationRowModel {
  kind: 'mutation'
  key: string
  /** The file the call named, `null` where it named none. */
  path: string | null
  status: ToolCallStatus
  diff: DiffResult | null
  output: OutputResult | null
  /** Whether that output is shown without asking. */
  open: boolean
}

/** One call loud enough for a row of its own: a command, always, and a failure of any other kind.
 *
 * A command earns a row because the line it ran is the fact worth reading, and its output is one
 * click away. A failure earns one because the thing that went wrong should be the thing you see. */
export interface CallRowModel {
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
  open: boolean
}

/** One kind's tally inside a folded run, in Argo's own vocabulary. A count rather than a sentence
 * because a sentence degrades into "read a file, read a file, read a file" at thirty calls. */
export interface QuietCount {
  word: string
  count: number
}

/** A run of consecutive observation, folded to one line. */
export interface QuietRowModel {
  kind: 'quiet'
  key: string
  counts: readonly QuietCount[]
}

export type ToolRow = MutationRowModel | CallRowModel | QuietRowModel | MediaRowModel

/** What one call is worth: its own loud row, a share of a folded quiet one, or nothing. */
type CallRole = 'none' | 'mutation' | 'media' | 'loud' | 'quiet'

/**
 * Which row one call is worth, decided kind by kind so that a kind added to the union has to be
 * classified here rather than falling silently into the quiet fold.
 *
 * `none` is not a silent drop: a delegate's work is the child's and the Subagents section owns it,
 * and a plan call's row is the Turn's one plan row. Everything else lands somewhere — and a FAILURE
 * of either lands loud anyway, because a failure nothing renders is a failure you never see.
 */
function roleOf({ kind, status, result }: ToolCall): CallRole {
  const failed = status === 'failed'
  // Pixels are loud whatever kind of call produced them, which is why this sits above the switch: a
  // screenshot reaches the agent from a `read`, a `fetch`, or an MCP browser tool under `other`, and
  // none of those kinds is the fact worth reading — the picture is. Ahead of the failure branch too,
  // because a call that failed and STILL returned an image returned the thing worth looking at.
  if (result?.kind === 'media') return 'media'
  switch (kind) {
    case 'edit':
      return 'mutation'
    // A delegate's failure is reported by the subagent row it belongs to, so even that stays out.
    case 'delegate':
      return 'none'
    case 'execute':
      return 'loud'
    case 'plan':
      return failed ? 'loud' : 'none'
    case 'read':
    case 'search':
    case 'fetch':
    case 'other':
      return failed ? 'loud' : 'quiet'
  }
}

const isRunning = (status: ToolCallStatus): boolean =>
  status === 'pending' || status === 'in_progress'

const outputOf = (call: ToolCall): OutputResult | null =>
  call.result?.kind === 'output' ? call.result : null

function mutationRow(call: ToolCall): MutationRowModel {
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
    open: call.status === 'failed',
  }
}

function callRow(call: ToolCall): CallRowModel {
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
function quietRow(run: readonly ToolCall[]): QuietRowModel {
  const byKind = new Map<ToolCallKind, number>()
  for (const call of run) byKind.set(call.kind, (byKind.get(call.kind) ?? 0) + 1)
  return {
    kind: 'quiet',
    key: `quiet:${run[0]?.id ?? ''}`,
    counts: [...byKind].map(([kind, count]) => ({ word: QUIET_WORD[kind] ?? kind, count })),
  }
}

/** The row a loud call is worth. Split out so `foldRun` stays about the FOLD and adding a fourth loud
 * kind does not deepen the branch that decides where a run breaks. */
function loudRow(call: ToolCall, role: CallRole, openMedia: Set<string>): ToolRow | null {
  if (role === 'mutation') return mutationRow(call)
  if (role === 'media') return mediaRow(call, openMedia.has(call.id))
  return role === 'loud' ? callRow(call) : null
}

/** One stretch of calls, run-length folded. A call worth no row does not break a run either: there
 * is no row for the break to show, and the observation either side of it is still consecutive. */
function foldRun(calls: readonly ToolCall[], openMedia: Set<string>): ToolRow[] {
  const rows: ToolRow[] = []
  let run: ToolCall[] = []
  const breakRun = (): void => {
    if (run.length > 0) rows.push(quietRow(run))
    run = []
  }
  for (const call of calls) {
    const role = roleOf(call)
    if (role === 'quiet') run.push(call)
    const loud = loudRow(call, role, openMedia)
    if (loud !== null) {
      breakRun()
      rows.push(loud)
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
  // The media bound spans the whole Turn rather than one bucket: which shots are recent is a fact
  // about the exchange, and a per-paragraph count would open four more of them at every paragraph.
  const openMedia = openMediaIds(turn)
  return new Map([...buckets].map(([index, calls]) => [index, foldRun(calls, openMedia)]))
}
