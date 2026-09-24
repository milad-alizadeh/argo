import { expect, test } from 'bun:test'
import { type Ticket, ticketError } from '@/domains/tickets/contract/contract'
import { ticketForSelection, ticketSelectionState } from './selected-ticket'

const closedTicket = {
  key: '#2582',
  url: 'https://github.com/milad-alizadeh/argo/issues/2582',
  title: 'Drive managed Claude Sessions',
  body: null,
  state: 'closed',
  status: { id: 'closed', name: 'Closed', category: 'completed' },
  priority: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  labels: [],
  type: null,
  children: [],
  blockedBy: [],
} satisfies Ticket

test('shows the resolved Ticket when a route selects one outside the open backlog', () => {
  expect(ticketForSelection([], '#2582', closedTicket)).toBe(closedTicket)
})

test('reports a failed direct Ticket read when the selected Ticket is not in the backlog', () => {
  const error = ticketError('github-unreachable', 'ticket-read')

  expect(
    ticketSelectionState({
      tickets: [],
      selectedKey: '#2582',
      resolvedTicket: null,
      pending: false,
      error,
    }),
  ).toEqual({ kind: 'failure', error })
})
