// One active page of a scope read as the Account, each failure named as the screen's Ticket error.
import { randomUUID } from 'node:crypto'
import { type ReadCall, readAs } from '../read-as'
import type { TicketSyncDependencies } from './ticket-sync-machine'

export function ticketPageReader(
  dependencies: Pick<ReadCall, 'access' | 'providers'>,
): TicketSyncDependencies['readPage'] {
  return async ({ accountId, scope }, cursor) => {
    const call = { ...dependencies, requestId: randomUUID() }
    const read = await readAs(call, accountId, (source, reader) =>
      source.page(reader, { scope, query: '', cursor }),
    )
    return read.ok ? { ok: true, value: read.value } : { ok: false, failure: read.error.code }
  }
}
