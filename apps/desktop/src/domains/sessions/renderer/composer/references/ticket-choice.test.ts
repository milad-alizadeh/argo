import { expect, test } from 'bun:test'
import type { Ticket } from '@/domains/tickets/api/ticket'
import { ticketChoice } from './ticket-choice'

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    key: 'ENG-42',
    url: null,
    title: 'Keep the Composer draft in sync',
    body: null,
    state: 'open',
    status: { id: 'started', name: 'In Progress', category: 'started' },
    priority: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    labels: [],
    type: null,
    children: [],
    blockedBy: [{ key: 'ENG-9', title: 'Store the refresh token', state: 'open' }],
    ...overrides,
  }
}

test('keeps the provider, the blocked mark and a terminal status', () => {
  expect(ticketChoice('linear', ticket())).toEqual({
    provider: 'linear',
    key: 'ENG-42',
    title: 'Keep the Composer draft in sync',
    status: 'In Progress',
    terminal: false,
    blocked: true,
  })
  expect(
    ticketChoice(
      'github',
      ticket({
        state: 'closed',
        status: { id: 'done', name: 'Done', category: 'completed' },
        blockedBy: null,
      }),
    ).blocked,
  ).toBeNull()
  expect(ticketChoice('github', ticket({ blockedBy: [] })).blocked).toBe(false)
})
