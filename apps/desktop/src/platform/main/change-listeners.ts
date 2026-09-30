// Announces a change to each listener; one that throws is reported and cannot starve the others.
export class ChangeListeners<Change> {
  readonly #listeners = new Set<(change: Change) => void>()

  protected announce(change: Change): void {
    for (const listener of this.#listeners) {
      try {
        listener(change)
      } catch (error) {
        console.warn('A change listener failed.', error)
      }
    }
  }

  subscribe(listener: (change: Change) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
