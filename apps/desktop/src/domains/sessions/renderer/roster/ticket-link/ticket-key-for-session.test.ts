import { expect, test } from 'bun:test'
import { ticketKeyForSession, ticketRouteForSession } from './ticket-key-for-session'
import { session } from './use-session-ticket-link-fixtures'

test('uses the branch ticket key when a Session has no asserted Ticket link', () => {
  const branchSession = {
    ...session('first-prompt'),
    branch: 'argo/#2582-model-based-testing',
    cwd: '/workspace/argo',
  }

  expect(ticketKeyForSession(branchSession)).toBe('#2582')
  expect(ticketRouteForSession(branchSession)).toBe('/tickets/%232582')
})

test('uses the asserted Ticket key over the branch ticket key', () => {
  const linkedSession = {
    ...session('first-prompt'),
    branch: 'argo/#2582-model-based-testing',
    cwd: '/workspace/argo',
    ticket: {
      projectId: 'project-1',
      key: 'ARGO-1',
      title: 'A linked Ticket',
      state: 'open' as const,
      createdAt: '2026-09-23T00:00:00.000Z',
    },
  }

  expect(ticketKeyForSession(linkedSession)).toBe('ARGO-1')
  expect(ticketRouteForSession(linkedSession)).toBe('/tickets/ARGO-1')
})

test('has no Ticket route when neither the Session nor its branch identifies one', () => {
  const sessionWithoutTicket = {
    ...session('first-prompt'),
    branch: 'main',
    cwd: '/workspace/argo',
  }

  expect(ticketKeyForSession(sessionWithoutTicket)).toBeNull()
  expect(ticketRouteForSession(sessionWithoutTicket)).toBeNull()
})
