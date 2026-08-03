import {
  type Agent,
  derived,
  isSteerable,
  openTurn,
  rootAgent,
  type SessionPosture,
  type SessionStatus,
  type StopReason,
  type Tiered,
} from '../../shared'
import { ASK_TOOL } from './toolCalls'

// A live process can sit quiet mid-tool; only a transcript touched within this window
// corroborates an actively-running session — beyond it, ambiguity resolves down.
export const RECENT_ACTIVITY_MS = 10 * 60 * 1000

// The stop reasons that mean the agent HALTED rather than finished. `end_turn` is a completed
// exchange; these three are a wall it hit, which is a different thing to tell you about.
const HALTING_REASONS: readonly StopReason[] = ['max_tokens', 'max_turn_requests', 'refusal']

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

// `ended` needs a process exit Argo WITNESSED, and the one it witnesses is its own PTY dying —
// which is precisely the `orphaned` posture (claimed, PTY gone). Everything else floors at
// `idle`: a session Argo never owned may simply be sitting quiet, and calling that a shutdown
// would be a termination nobody observed.
function quietStatus(signals: StatusSignals, live: boolean): SessionStatus {
  return !live && signals.posture === 'orphaned' ? 'ended' : 'idle'
}

function statusOf(signals: StatusSignals, live: boolean): SessionStatus {
  const root = rootAgent(signals.agents)
  // No Turns to read (an unparseable body, or a session that has only just started) leaves
  // liveness UNTOUCHED: the process match plus recency is the reading, and only the refinements
  // a segmented tree would add go absent (cockpit-failure-states-spec.md §8).
  if (root === null || root.turns.length === 0) {
    return live ? 'running' : quietStatus(signals, live)
  }
  if (live) {
    if (hasPendingAsk(root)) return 'asking'
    if (openTurn(root) !== null) return 'running'
  }
  // `stopped` is managed-only: reading a wall the agent hit as a wall (rather than as a quiet
  // idle) is a claim about a session Argo owns, and CONTEXT.md L2 collapses it to `idle` the
  // moment the same session is observed from the outside.
  const halted = root.turns.at(-1)?.stopReason ?? null
  if (isSteerable(signals.posture) && halted !== null && HALTING_REASONS.includes(halted)) {
    return 'stopped'
  }
  return quietStatus(signals, live)
}

/**
 * The Session's status, honesty-gated by posture (CONTEXT.md L2). External and orphaned floor at
 * `running · asking? · idle · ended`; only a managed Session can reach `stopped`, and `permission`
 * awaits the companion-plugin channel that carries a prompt no transcript holds.
 *
 * The tier is DERIVED for every posture, managed included. Argo owns the PTY, but it does not own
 * the link from that PTY to a transcript file — the match is cwd plus a time window, which is not
 * a unique key. Grading this DIRECT off ownership alone would be exactly the false DIRECT the
 * degrade-down rule exists to prevent.
 */
export function deriveSessionStatus(signals: StatusSignals): Tiered<SessionStatus> {
  return derived(statusOf(signals, signals.processMatch && isRecent(signals)))
}
