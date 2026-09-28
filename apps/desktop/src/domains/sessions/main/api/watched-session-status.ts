import type { Harness } from '@/harnesses/harness'
import type { HistoryTurn } from '@/harnesses/registration'

// A terminal killed partway through a turn writes nothing more, so an open turn this quiet is unknown.
export const WATCHED_TURN_QUIET_LIMIT_MS = 5 * 60_000

type WatchedTurn = { turn: HistoryTurn; at: number }
type WatchedWrite = { harness: Harness; nativeId: string; turn: HistoryTurn | null; at: number }

// What a watched Session's history file last said about its turn, kept in memory like live status.
export class WatchedSessionStatus {
  readonly #turns = new Map<string, WatchedTurn>()
  readonly #quietTimers = new Map<string, ReturnType<typeof setTimeout>>()
  readonly #changed: () => void

  constructor(changed: () => void) {
    this.#changed = changed
  }

  // A write with no turn marker in reach still means a turn is under way.
  record({ harness, nativeId, turn, at }: WatchedWrite): void {
    const key = `${harness}\u0000${nativeId}`
    this.#turns.set(key, { turn: turn ?? 'open', at })
    const pending = this.#quietTimers.get(key)
    if (pending !== undefined) clearTimeout(pending)
    this.#quietTimers.delete(key)
    if (turn === 'closed') return
    this.#quietTimers.set(
      key,
      setTimeout(() => {
        this.#quietTimers.delete(key)
        this.#changed()
      }, WATCHED_TURN_QUIET_LIMIT_MS),
    )
  }

  // The stored Harness column is plain text, so a read takes any Harness name.
  statusOf(harness: string, nativeId: string, now: number): 'running' | 'idle' | null {
    const watched = this.#turns.get(`${harness}\u0000${nativeId}`)
    if (watched === undefined) return null
    if (watched.turn === 'closed') return 'idle'
    return now - watched.at < WATCHED_TURN_QUIET_LIMIT_MS ? 'running' : null
  }

  dispose(): void {
    for (const timer of this.#quietTimers.values()) clearTimeout(timer)
    this.#quietTimers.clear()
  }
}
