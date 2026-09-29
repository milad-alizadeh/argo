// One page of a scope's active Tickets or of a query's matches, or one Ticket by native ID, read as
// the Account, each failure named as the screen's Ticket error.
import { randomUUID } from 'node:crypto'
import { type ReadCall, readAs } from '../read-as'
import type { TicketSyncDependencies } from './ticket-sync-machine'

export function ticketPageReader(
  dependencies: Pick<ReadCall, 'access' | 'providers'>,
): TicketSyncDependencies['readPage'] {
  return async ({ accountId, scope, query, state }, cursor) => {
    const call = { ...dependencies, requestId: randomUUID() }
    const read = await readAs(call, accountId, (source, reader) =>
      source.page(reader, { scope, query, cursor, state }),
    )
    return read.ok ? { ok: true, value: read.value } : { ok: false, failure: read.error.code }
  }
}

export function ticketByIdReader(
  dependencies: Pick<ReadCall, 'access' | 'providers'>,
): TicketSyncDependencies['readTicket'] {
  return async ({ accountId, scope }, id) => {
    const call = { ...dependencies, requestId: randomUUID() }
    const read = await readAs(call, accountId, (source, reader) =>
      source.read(reader, { scope, id }),
    )
    return read.ok ? { ok: true, value: read.value } : { ok: false, failure: read.error.code }
  }
}
