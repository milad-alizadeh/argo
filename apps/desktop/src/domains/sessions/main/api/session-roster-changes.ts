// Announces the saved Sessions a write changed, so each Session List reads just those rows.
export class SessionRosterChanges {
  readonly #listeners = new Set<(sessionIds: readonly string[]) => void>()

  changed(sessionIds: readonly string[]): void {
    if (sessionIds.length === 0) return
    for (const listener of this.#listeners) listener(sessionIds)
  }

  subscribe(listener: (sessionIds: readonly string[]) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
