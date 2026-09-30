import type { Harness } from '@/harnesses/harness'
import type { HistoryTurn } from '@/harnesses/registration'
import type { SessionUpdate } from './session-update'

// A terminal killed partway through a turn writes nothing more, so an open turn this quiet is unknown.
export const WATCHED_TURN_QUIET_LIMIT_MS = 5 * 60_000

type WatchedTurn = { turn: HistoryTurn; at: number }
type WatchedSession = { harness: Harness; nativeId: string }
type WatchedWrite = WatchedSession & { turn: HistoryTurn | null; at: number }
type WatchedStatus = Extract<SessionUpdate['status'], 'running' | 'idle'>

// Turns a watched Session's history writes into its status: running for an open turn, idle for a
// closed one, and unknown once an open turn has been quiet too long, which `quiet` writes.
export class WatchedSessionStatus {
  readonly #turns = new Map<string, WatchedTurn>()
  readonly #quietTimers = new Map<string, ReturnType<typeof setTimeout>>()
  readonly #quiet: (session: WatchedSession) => void

  constructor(quiet: (session: WatchedSession) => void) {
    this.#quiet = quiet
  }

  // Returns the new status, or undefined when it holds. A write with no turn marker in reach still
  // means a turn is under way; a write after a quiet open turn opens it again.
  record({ harness, nativeId, turn, at }: WatchedWrite): WatchedStatus | undefined {
    const key = `${harness}\u0000${nativeId}`
    const observed = turn ?? 'open'
    const previous = this.#turns.get(key)
    const changed =
      previous?.turn !== observed ||
      (observed === 'open' && at - previous.at >= WATCHED_TURN_QUIET_LIMIT_MS)
    this.#turns.set(key, { turn: observed, at })
    const pending = this.#quietTimers.get(key)
    if (pending !== undefined) clearTimeout(pending)
    this.#quietTimers.delete(key)
    if (turn !== 'closed')
      this.#quietTimers.set(
        key,
        setTimeout(() => {
          this.#quietTimers.delete(key)
          this.#quiet({ harness, nativeId })
        }, WATCHED_TURN_QUIET_LIMIT_MS),
      )
    if (!changed) return undefined
    return observed === 'closed' ? 'idle' : 'running'
  }

  dispose(): void {
    for (const timer of this.#quietTimers.values()) clearTimeout(timer)
    this.#quietTimers.clear()
  }
}
