import { ChangeListeners } from '@/platform/main/change-listeners'

// Announces the saved Sessions a write or a live status changed, once a tick for any burst.
export class SessionListChanges extends ChangeListeners<readonly string[]> {
  readonly #pending = new Set<string>()

  changed(sessionIds: readonly string[]): void {
    const idle = this.#pending.size === 0
    for (const sessionId of sessionIds) this.#pending.add(sessionId)
    if (!idle || this.#pending.size === 0) return
    queueMicrotask(() => {
      const changed = [...this.#pending]
      this.#pending.clear()
      this.announce(changed)
    })
  }
}
