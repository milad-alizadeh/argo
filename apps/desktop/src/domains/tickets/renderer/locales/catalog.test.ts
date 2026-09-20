import { expect, test } from 'bun:test'
import { PROVIDERS } from '@/domains/accounts/contract/contract'
import { CONNECTION_STATES, TICKET_ERRORS } from '@/domains/tickets/contract/contract'
import tickets from '@/domains/tickets/renderer/locales/en.json'

test('the Tickets catalog answers every Ticket error code', () => {
  expect(Object.keys(tickets.error).sort()).toEqual(Object.keys(TICKET_ERRORS).sort())
})

test('the Tickets catalog answers every Connection state but ready', () => {
  const expected = CONNECTION_STATES.filter((state) => state !== 'ready').sort()
  expect(Object.keys(tickets.connection.state).sort()).toEqual([...CONNECTION_STATES].sort())
  expect(Object.keys(tickets.problem.connection).sort()).toEqual(expected)
})

test('the Tickets catalog answers every provider', () => {
  const expected = [...PROVIDERS].sort()
  expect(Object.keys(tickets.source).sort()).toEqual(expected)
})
