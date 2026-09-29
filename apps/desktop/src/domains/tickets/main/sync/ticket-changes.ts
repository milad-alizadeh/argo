// Announces that a provider scope's saved Tickets changed; each reader refetches from SQLite.
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type {
  PriorityRequest,
  StatusRequest,
  TicketOperationOutcome,
} from '../operations/ticket-operation-machine'
import type { TicketSyncSupervisorCommand } from './ticket-sync-supervisor-machine'

export class TicketChanges {
  readonly #listeners = new Set<(target: TicketScopeTarget) => void>()

  // A listener that throws cannot fail the write that already committed, nor starve the others.
  readonly changed = (target: TicketScopeTarget): void => {
    for (const listener of this.#listeners) {
      try {
        listener(target)
      } catch (error) {
        console.warn('A Ticket change listener failed.', error)
      }
    }
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
  // A scan request, or a view watching or leaving a scope.
  send: (command: TicketSyncSupervisorCommand) => void
  // Moves a Ticket to a status through the operation supervisor, and answers how that ended.
  changeStatus: (request: StatusRequest) => Promise<TicketOperationOutcome>
  // Moves a Ticket to a priority level the same way.
  changePriority: (request: PriorityRequest) => Promise<TicketOperationOutcome>
}
