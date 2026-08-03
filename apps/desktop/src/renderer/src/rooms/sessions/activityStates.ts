import type { StopReason, ToolCallStatus } from '@shared'
import type { DotGlow, RosterTone } from '@/shared/status'

// The Activity surface's state vocabulary: the dot a state draws and the word it is called, in ONE
// table per state union. Both are the same fact told two ways, so a second switch over the same
// union is how the two spellings drift (`cockpit-status-vocabulary.md`, the one rule): a subagent
// that is working and a tool call that is working both read `running`.

/** The dot a row draws. Same three channels as the rail's, because state is carried entirely by
 * the dot wherever it appears. */
export interface ActivityDot {
  tone: RosterTone
  glow: DotGlow
  pulse: boolean
}

/** `running` while a turn is open, `queued` before its first, `done` once every turn closed. */
export type SubagentStatus = 'running' | 'queued' | 'done'

/** How a state renders: its dot, and the one word it is called by wherever a word is shown. */
export interface ActivityState {
  dot: ActivityDot
  word: string
}

const RUNNING: ActivityState = { dot: { tone: 'run', glow: 'live', pulse: true }, word: 'running' }
const QUEUED: ActivityState = { dot: { tone: 'gray', glow: 'faint', pulse: false }, word: 'queued' }
const DONE: ActivityState = { dot: { tone: 'done', glow: 'quiet', pulse: false }, word: 'done' }
// A failure burns red and holds still — as bright as needs-you, it just is not still in motion.
const FAILED: ActivityState = { dot: { tone: 'red', glow: 'quiet', pulse: false }, word: 'failed' }

/** A tool call's state. `in_progress` is an enum name, not a word a surface shows — the table holds
 * the word, so nothing downstream reformats an identifier for display. */
export const STEP_STATES: Record<ToolCallStatus, ActivityState> = {
  pending: QUEUED,
  in_progress: RUNNING,
  completed: DONE,
  failed: FAILED,
}

/** A subagent's state — the same three words, unchanged. */
export const SUBAGENT_STATES: Record<SubagentStatus, ActivityState> = {
  running: RUNNING,
  queued: QUEUED,
  done: DONE,
}

/** What a turn's state is called: `running` while nothing stopped it, else the CLI's own stop
 * reason verbatim — `unknown` included, because a guessed reason is a fabricated fact. */
export const turnWord = (stopReason: StopReason | null): string =>
  stopReason === null ? 'running' : stopReason
