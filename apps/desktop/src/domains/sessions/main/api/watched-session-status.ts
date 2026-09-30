import type { Harness } from '@/harnesses/harness'
import type { HistoryTurn } from '@/harnesses/registration'

// A terminal killed partway through a turn writes nothing more, so an open turn this quiet is unknown.
export const WATCHED_TURN_QUIET_LIMIT_MS = 5 * 60_000

type WatchedTurn = { turn: HistoryTurn; at: number }
type WatchedSession = { harness: Harness; nativeId: string }
type WatchedWrite = WatchedSession & { turn: HistoryTurn | null; at: number }
type WatchedStatus = 'running' | 'idle' | 'unknown'

// Turns a watched Session's history writes into its status: running for an open turn, idle for a
// closed one, and unknown once an open turn has been quiet too long.
export class WatchedSessionStatus {
  readonly #turns = new Map<string, WatchedTurn>()
  readonly #quietTimers = new Map<string, ReturnType<typeof setTimeout>>()
  readonly #write: (session: WatchedSession, status: WatchedStatus) => void

  constructor(write: (session: WatchedSession, status: WatchedStatus) => void) {
    this.#write = write
  }

  // A write with no turn marker in reach still means a turn is under way; a write after a quiet
  // open turn opens it again.
  record({ harness, nativeId, turn, at }: WatchedWrite): void {
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
    if (changed) this.#write({ harness, nativeId }, observed === 'closed' ? 'idle' : 'running')
    if (turn === 'closed') return
    this.#quietTimers.set(
      key,
      setTimeout(() => {
        this.#quietTimers.delete(key)
        this.#write({ harness, nativeId }, 'unknown')
      }, WATCHED_TURN_QUIET_LIMIT_MS),
    )
  }

  dispose(): void {
    for (const timer of this.#quietTimers.values()) clearTimeout(timer)
    this.#quietTimers.clear()
  }
}
