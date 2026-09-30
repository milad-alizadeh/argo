// Announces the saved Sessions a write or a live status changed, once a tick for any burst, so each
// Session List reads just those rows.
export class SessionListChanges {
  readonly #listeners = new Set<(sessionIds: readonly string[]) => void>()
  readonly #pending = new Set<string>()

  changed(sessionIds: readonly string[]): void {
    const idle = this.#pending.size === 0
    for (const sessionId of sessionIds) this.#pending.add(sessionId)
    if (!idle || this.#pending.size === 0) return
    queueMicrotask(() => {
      const changed = [...this.#pending]
      this.#pending.clear()
      for (const listener of this.#listeners) listener(changed)
    })
  }

  subscribe(listener: (sessionIds: readonly string[]) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
