// Announces that a provider scope's saved Tickets changed; each reader refetches from SQLite.
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from './database/ticket-upsert'
import type { TicketSyncRequest } from './sync/ticket-sync-machine'

export class TicketChanges {
  readonly #listeners = new Set<(target: TicketScopeTarget) => void>()

  changed(target: TicketScopeTarget): void {
    for (const listener of this.#listeners) listener(target)
  }

  subscribe(listener: (target: TicketScopeTarget) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}

// The SQLite read model behind the Ticket procedures, and the scan that fills it.
export type TicketIndex = {
  database: Database
  changes: TicketChanges
  requestSync: (request: TicketSyncRequest) => void
}
