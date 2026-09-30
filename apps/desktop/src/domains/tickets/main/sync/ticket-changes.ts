// Announces that a provider scope's saved Tickets changed; each reader refetches from SQLite.
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ChangeListeners } from '@/platform/main/change-listeners'
import type { PriorityRequest, StatusRequest, TicketOperationOutcome } from '../operations'
import type { TicketSyncSupervisorCommand } from './ticket-sync-supervisor-machine'

// A listener that throws cannot fail the write that already committed.
export class TicketChanges extends ChangeListeners<TicketScopeTarget> {
  readonly changed = (target: TicketScopeTarget): void => this.announce(target)
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
