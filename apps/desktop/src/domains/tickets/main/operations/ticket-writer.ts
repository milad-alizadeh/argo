// A Ticket change asked of the provider as the Account, each failure named as the Ticket error.
import { randomUUID } from 'node:crypto'
import { type ReadCall, readAs } from '../read-as'
import type {
  TicketOperationDependencies,
  TicketOperationRequest,
  TicketWrite,
} from './ticket-operation-machine'

export function ticketWriter(
  dependencies: Pick<ReadCall, 'access' | 'providers'>,
): TicketOperationDependencies['write'] {
  return async (request: TicketOperationRequest): Promise<TicketWrite> => {
    const { accountId, scope, key } = request
    const call = { ...dependencies, requestId: randomUUID() }
    switch (request.operation) {
      case 'status': {
        const written = await readAs(call, accountId, (source, reader) =>
          source.update(reader, { scope, key, statusId: request.statusId }),
        )
        return written.ok
          ? { ok: true, confirmed: { operation: 'status', status: written.value } }
          : { ok: false, failure: written.error.code }
      }
      case 'priority': {
        const written = await readAs(call, accountId, (source, reader) =>
          source.updatePriority(reader, { scope, key, priorityLevel: request.priorityLevel }),
        )
        return written.ok
          ? { ok: true, confirmed: { operation: 'priority', priority: written.value } }
          : { ok: false, failure: written.error.code }
      }
    }
  }
}
