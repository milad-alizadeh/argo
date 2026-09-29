import { expect, test } from 'bun:test'
import { CONNECTION_STATES, TICKET_ERRORS } from '@/domains/tickets/api/messages'
import tickets from './en.json'

test('the Tickets catalog answers every Ticket error code', () => {
  expect(Object.keys(tickets.error).sort()).toEqual(Object.keys(TICKET_ERRORS).sort())
})

test('the Tickets catalog answers every Connection state but ready', () => {
  const expected = CONNECTION_STATES.filter((state) => state !== 'ready').sort()
  expect(Object.keys(tickets.connection.state).sort()).toEqual([...CONNECTION_STATES].sort())
  expect(Object.keys(tickets.problem.connection).sort()).toEqual(expected)
})
