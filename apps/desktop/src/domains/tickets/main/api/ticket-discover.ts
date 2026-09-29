import type { TicketDiscoverReply } from '@/domains/tickets/contract/contract'
import { type Call, readAs } from '../read-as'

export async function discoverSources(call: Call, accountId: string): Promise<TicketDiscoverReply> {
  const { requestId, projectId } = call
  const read = await readAs(call, accountId, (source, reader) => source.discover(reader))
  if (!read.ok) return read.error
  return { version: 1, type: 'ticket.discovered', requestId, projectId, scopes: read.value }
}
