// A status change asked of the provider as the Account, each failure named as the Ticket error.
import { randomUUID } from 'node:crypto'
import { type ReadCall, readAs } from '../read-as'
import type { TicketOperationDependencies } from './ticket-operation-machine'

export function ticketStatusWriter(
  dependencies: Pick<ReadCall, 'access' | 'providers'>,
): TicketOperationDependencies['writeStatus'] {
  return async ({ accountId, scope, key, statusId }) => {
    const call = { ...dependencies, requestId: randomUUID() }
    const written = await readAs(call, accountId, (source, reader) =>
      source.update(reader, { scope, key, statusId }),
    )
    return written.ok
      ? { ok: true, status: written.value }
      : { ok: false, failure: written.error.code }
  }
}
