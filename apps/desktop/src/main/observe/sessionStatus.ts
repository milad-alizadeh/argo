import {
  type Agent,
  derived,
  direct,
  openTurn,
  rootAgent,
  type SessionPosture,
  type SessionStatus,
  type Tiered,
} from '../../shared'
import { ASK_TOOL } from './toolCalls'

// A live process can sit quiet mid-tool; only a transcript touched within this window
// corroborates an actively-running session — beyond it, ambiguity resolves down.
export const RECENT_ACTIVITY_MS = 10 * 60 * 1000

export interface StatusSignals {
  posture: SessionPosture
  /** A live CLI process was matched on this Session's cwd. */
  processMatch: boolean
  lastTimestampMs: number | null
  nowMs: number
  /** The runtime tree, empty when the transcript could not be parsed into one. */
  agents: Agent[]
}

function isRecent({ lastTimestampMs, nowMs }: StatusSignals): boolean {
  return lastTimestampMs !== null && nowMs - lastTimestampMs <= RECENT_ACTIVITY_MS
}

/**
 * A pending `AskUserQuestion` in the Turn still running is the ONLY honest `asking` for a session
 * Argo does not own: the tool call landed in the transcript and no result answered it. A resolved
 * question, or one sitting in a Turn that has since ended, reads as `idle` — a false `asking` is
 * a false-active, so ambiguity degrades down. An agent's free-form question is indistinguishable
 * from idle in the record and is never promoted here.
 */
function hasPendingAsk(root: Agent): boolean {
  const turn = openTurn(root)
  if (turn === null) return false
  return turn.toolCalls.some((call) => call.name === ASK_TOOL && call.status === 'pending')
}

function statusOf(signals: StatusSignals, live: boolean): SessionStatus {
  if (!live) return 'idle'
  const root = rootAgent(signals.agents)
  // No Turns to read (an unparseable body, or a session that has only just started) leaves
  // liveness UNTOUCHED: the process match plus recency is the reading, and only the refinements
  // a segmented tree would add go absent (cockpit-failure-states-spec.md §8).
  if (root === null || root.turns.length === 0) return 'running'
  if (hasPendingAsk(root)) return 'asking'
  return openTurn(root) === null ? 'idle' : 'running'
}

/**
 * The Session's status, honesty-gated by posture (CONTEXT.md L2). A managed Session's liveness is
 * DIRECT — Argo holds the PTY. External and orphaned are observation-only, so theirs is always
 * DERIVED, and they floor at `running · asking? · idle`: `permission` needs a prompt no transcript
 * reliably carries, `stopped` needs a stop reason it may not carry, and `ended` needs a process
 * exit Argo never witnessed. None of the three is ever guessed into place.
 */
export function deriveSessionStatus(signals: StatusSignals): Tiered<SessionStatus> {
  const status = statusOf(signals, signals.processMatch && isRecent(signals))
  return signals.posture === 'managed' ? direct(status) : derived(status)
}
