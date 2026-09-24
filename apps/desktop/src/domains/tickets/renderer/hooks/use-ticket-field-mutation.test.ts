import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import type { TicketRead } from '@/domains/tickets/contract/contract'
import { standalone } from '../detail/ticket-fixtures'
import { patchTicket } from './use-ticket-field-mutation'
import { ticketReadKey } from './use-tickets'

const ticketRead: TicketRead = {
  version: 1,
  type: 'ticket.read',
  requestId: 'read-1',
  projectId: 'project-1',
  scope: 'repository',
  ticket: standalone,
  statuses: [],
}

test('updates the directly-read Ticket cache after a field mutation', () => {
  const client = new QueryClient()
  client.setQueryData(ticketReadKey('project-1', standalone.key), ticketRead)

  patchTicket(client, { projectId: 'project-1', key: standalone.key }, (ticket) => ({
    ...ticket,
    state: 'open',
    status: { id: 'open', name: 'Open', category: 'unstarted' },
    priority: { level: 2, label: 'High' },
  }))

  expect(
    client.getQueryData<TicketRead>(ticketReadKey('project-1', standalone.key))?.ticket,
  ).toEqual({
    ...ticketRead.ticket,
    state: 'open',
    status: { id: 'open', name: 'Open', category: 'unstarted' },
    priority: { level: 2, label: 'High' },
  })
})
