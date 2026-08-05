import { type MediaRowModel, mediaRow } from './feedMedia'
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
// It is a MATRIX (`ROLE`, below), not a rule with exceptions. Two axes, because two independent
// facts decide a row and a single-axis rule has to smuggle the other one in as a special case:
//
//   EFFECT — what the call did to the world, which its KIND decides.
//   YIELD  — what came back, which its RESULT and STATUS decide together.
//
// The reading the matrix encodes: irreversible state change is unmissable, observation is worth one
// line, a failure of anything is worth its own, and a picture outranks all of it because the picture
// IS the fact. What makes the quiet tier hold is the BREAK — a fold ends at the next loud row — so
// "edited a file, ran a command, read a file" cannot silently fold into one line.

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
}

/** One kind's tally inside a folded run, in Argo's own vocabulary. A count rather than a sentence
 * because a sentence degrades into "read a file, read a file, read a file" at thirty calls. */
export interface QuietCount {
  word: string
  count: number
}

/** One folded call, for the list behind the count. The target and nothing else: what a read is
 * worth naming is the file it read, and a row per call is why the fold exists in the first place. */
export interface QuietCallModel {
  key: string
  word: string
  /** The file or pattern the call named, `null` where it named none. */
  target: string | null
}

/** A run of consecutive observation, folded to one line — and the calls behind it.
 *
 * The COUNTS are what the row shows; `calls` is what it opens onto. Folding without keeping them
 * was a fold that discarded: "read 4" with no way to learn which four, so the one question the row
 * reliably prompts had no answer anywhere in the app. Provenance is worth one line by default and
 * worth its detail on demand — those are not in tension, they are the two halves of a disclosure. */
export interface QuietRowModel {
  kind: 'quiet'
  key: string
  counts: readonly QuietCount[]
  calls: readonly QuietCallModel[]
  /** Whether every call in this run is a kind Argo RECOGNISED as observation.
   *
   * `false` where any of them fell to `other`, which is the parser saying it did not know the tool's
   * name — and an unknown name is not evidence of a read. The row folds either way, because folding
   * is the quieter reading and ambiguity resolves that direction; what it must not do is put an
   * unknown call under a glyph that says "looked at". `EnterWorktree` is the case that named this:
   * it creates a worktree on disk and rendered through a pair of binoculars. */
  observed: boolean
}

export type ToolRow = MutationRowModel | CallRowModel | QuietRowModel | MediaRowModel

/** What one call is worth: its own loud row, a share of a folded quiet one, or nothing. */
type CallRole = 'none' | 'mutation' | 'media' | 'loud' | 'quiet'

/** THE MATRIX'S FIRST AXIS: what a call did to the world, which is the only thing its kind decides.
 *
 * `runs` sits between `mutates` and `observes` on purpose and is grouped with neither: a shell
 * command's effect is genuinely UNKNOWN to a reader of the transcript — `ls` and `rm -rf` are one
 * kind — and unknown-effect belongs on the loud side, because a fold is a claim that nothing
 * important happened and that claim cannot be made about a command line nobody read. */
type Effect = 'mutates' | 'runs' | 'observes' | 'delegates' | 'plans'

const EFFECT: Readonly<Record<ToolCallKind, Effect>> = {
  edit: 'mutates',
  execute: 'runs',
  read: 'observes',
  search: 'observes',
  fetch: 'observes',
  // `other` is an unrecognised tool NAME, not an unrecognised effect: the parser reaches it only
  // when its table did not know the name, and the overwhelming majority of those are lookups.
  // Observation is the quieter reading, which is the direction ambiguity resolves in.
  other: 'observes',
  delegate: 'delegates',
  plan: 'plans',
}

/** THE MATRIX'S SECOND AXIS: what came back. Status and result read as one fact because they answer
 * one question — a call with no result yet and a call that failed are different rows, and a call
 * that failed while still producing a picture is a third. */
type Yield = 'failed' | 'picture' | 'patch' | 'text' | 'nothing'

function yieldOf({ status, result }: ToolCall): Yield {
  // Pixels first, ahead of failure: a call that failed and STILL returned an image returned the
  // thing worth looking at, and a screenshot reaches the agent from a read, a fetch, or an MCP
  // browser tool under `other` — so no kind is the fact worth reading here. The picture is.
  if (result?.kind === 'media') return 'picture'
  if (status === 'failed') return 'failed'
  if (result === null) return 'nothing'
  return result.kind === 'diff' ? 'patch' : 'text'
}

/**
 * THE MATRIX. Every cell is an answer rather than a default, so a kind or a result shape added to
 * either union fails to compile until someone decides what it is worth — which is the whole reason
 * this is a table and not a chain of `if`s with a fallthrough at the bottom.
 *
 * `none` is never a silent drop: a delegate's work is the CHILD's and the Subagents section owns it,
 * and a plan call's row is the Turn's one plan row. But a FAILED plan write lands loud, because
 * nothing else on the surface would say the list did not update; a failed delegate does not, because
 * the subagent row it belongs to already reports it.
 */
const M = 'mutation'
const ROLE: Readonly<Record<Effect, Readonly<Record<Yield, CallRole>>>> = {
  mutates: { failed: M, picture: 'media', patch: M, text: M, nothing: M },
  runs: { failed: 'loud', picture: 'media', patch: 'loud', text: 'loud', nothing: 'loud' },
  observes: { failed: 'loud', picture: 'media', patch: 'quiet', text: 'quiet', nothing: 'quiet' },
  delegates: { failed: 'none', picture: 'media', patch: 'none', text: 'none', nothing: 'none' },
  plans: { failed: 'loud', picture: 'media', patch: 'none', text: 'none', nothing: 'none' },
}

/** Which row one call is worth: one lookup through the matrix, and nowhere else to hide a rule. */
const roleOf = (call: ToolCall): CallRole => ROLE[EFFECT[call.kind]][yieldOf(call)]

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
  }
}

// EVERY output block starts CLOSED, and no row model carries an `open` flag to say otherwise.
//
// Derivation-decided openness was tried and is what this replaced: a failure opened because its
// text is the reason, and a short result opened because a caret over one line costs more than the
// line. Both readings are true of the row in isolation and both are wrong of the FEED, where a
// hundred and thirty commands land — the one thing a scroll surface must be is uniform, and a
// column where every third card is a different height is one you cannot skim at all. A closed row
// still shows its status, so a failure is not hidden by being folded; only its text is.

function callRow(call: ToolCall): CallRowModel {
  return {
    kind: 'call',
    key: `call:${call.id}`,
    callKind: call.kind,
    name: call.name,
    target: call.target,
    status: call.status,
    output: outputOf(call),
  }
}

/** The word a kind wears in a fold. The kind's own word where it already reads as one, so only the
 * two that would read as nouns are spelled out. */
const QUIET_WORD: Partial<Record<ToolCallKind, string>> = { search: 'searched', fetch: 'fetched' }

/** What one folded call is CALLED. The kind's word normally — but the host's own tool name where
 * the kind is `other`, because `other` is the parser saying it did not recognise the name, and a
 * fold reading `other 5` passes that shrug on to the reader as if it were a summary. `Skill 1 ·
 * ToolSearch 3` is the same honesty spent usefully: the name is a fact the record carried. */
const quietWord = (call: ToolCall): string =>
  call.kind === 'other' ? call.name : (QUIET_WORD[call.kind] ?? call.kind)

/** The tallies of one run, in the order the words first appeared — which is the order the work
 * happened in, and the only order that does not need explaining. */
function quietRow(run: readonly ToolCall[]): QuietRowModel {
  const byWord = new Map<string, number>()
  for (const call of run) byWord.set(quietWord(call), (byWord.get(quietWord(call)) ?? 0) + 1)
  return {
    kind: 'quiet',
    key: `quiet:${run[0]?.id ?? ''}`,
    observed: run.every((call) => call.kind !== 'other'),
    counts: [...byWord].map(([word, count]) => ({ word, count })),
    // In the order they happened, not grouped like the counts: opened, this is a sequence of what
    // the agent looked at, and the counts above it are already the by-kind reading.
    calls: run.map((call) => ({
      key: `quiet-call:${call.id}`,
      word: quietWord(call),
      target: call.target,
    })),
  }
}

/** The row a loud call is worth. Split out so `foldRun` stays about the FOLD and adding a fourth loud
 * kind does not deepen the branch that decides where a run breaks. */
function loudRow(call: ToolCall, role: CallRole): ToolRow | null {
  if (role === 'mutation') return mutationRow(call)
  if (role === 'media') return mediaRow(call)
  return role === 'loud' ? callRow(call) : null
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
    const loud = loudRow(call, role)
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
  return new Map([...buckets].map(([index, calls]) => [index, foldRun(calls)]))
}
