import type { ToolCall, ToolCallKind } from '../runtimeTree'

// WHAT ONE TOOL CALL IS WORTH — the Activity feed's loud/quiet policy, as a table.
//
// It is a MATRIX, not a rule with exceptions. Two axes, because two independent facts decide a row
// and a single-axis rule has to smuggle the other one in as a special case:
//
//   EFFECT — what the call did to the world, which its KIND decides.
//   YIELD  — what came back, which its RESULT and STATUS decide together.
//
// The reading it encodes: irreversible state change is unmissable, a failure of anything is worth
// its own row, machine chatter folds, and a picture outranks all of it because the picture IS the
// fact. It lives apart from the row models and the folding pass so that the POLICY can be read, and
// argued with, without reading the machinery that applies it.

/** What one call is worth: its own loud row, a share of a folded quiet one, or nothing. */
export type CallRole = 'none' | 'mutation' | 'media' | 'loud' | 'quiet'

/** THE MATRIX'S FIRST AXIS: what a call did to the world, which is the only thing its kind decides.
 *
 * `runs` sits between `mutates` and `observes` on purpose and is grouped with neither, even though
 * it now takes the same row as `observes`: a shell command's effect is genuinely UNKNOWN to a reader
 * of the transcript — `ls` and `rm -rf` are one kind — so it is not observation and must never
 * render as though it were. Same fold, different glyph and different word. Keeping it a separate
 * effect is what lets those two answers diverge again without re-deriving which calls were which. */
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
  // A command FOLDS, and its failure does not. Loud, a real session was a wall: thirty `find`,
  // `grep`, `ls` and `git log` lines whose text is longer than the prose around them and whose
  // content is almost never why you opened the feed. That is the same case the quiet fold was built
  // for, so it takes the same answer — and the fold is a collapse, not a drop: every command is
  // still there, in order, one caret away.
  //
  // KNOWN AND ACCEPTED: a shell command is the one kind whose effect the record does not describe,
  // so `rm -rf` and `git commit` fold in beside `ls`. Nothing here can tell them apart — the record
  // carries a command line and an exit status, and pattern-matching that line into "dangerous" and
  // "harmless" would be Argo guessing about the one thing it must not guess about. The honest
  // options were fold them all or fold none, and a wall nobody reads protects nobody.
  runs: { failed: 'loud', picture: 'media', patch: 'quiet', text: 'quiet', nothing: 'quiet' },
  observes: { failed: 'loud', picture: 'media', patch: 'quiet', text: 'quiet', nothing: 'quiet' },
  delegates: { failed: 'none', picture: 'media', patch: 'none', text: 'none', nothing: 'none' },
  plans: { failed: 'loud', picture: 'media', patch: 'none', text: 'none', nothing: 'none' },
}

/** Which row one call is worth: one lookup through the matrix, and nowhere else to hide a rule. */
export const roleOf = (call: ToolCall): CallRole => ROLE[EFFECT[call.kind]][yieldOf(call)]
