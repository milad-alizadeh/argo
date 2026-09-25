import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ticketAge } from './ticket-age'

const NOW = Date.parse('2026-09-13T12:00:00Z')

test('a Ticket reads its age as a human-readable relative date', () => {
  for (const [createdAt, short, long] of [
    ['2026-09-13T11:59:30Z', 'opened just now', 'Opened just now'],
    ['2026-09-13T11:15:00Z', 'opened 45 minutes ago', 'Opened 45 minutes ago'],
    ['2026-09-13T11:00:00Z', 'opened 1 hour ago', 'Opened 1 hour ago'],
    ['2026-09-10T12:00:00Z', 'opened 3 days ago', 'Opened 3 days ago'],
    ['2026-08-30T12:00:00Z', 'opened 14 days ago', 'Opened 14 days ago'],
    ['2026-05-13T12:00:00Z', 'opened 4 months ago', 'Opened 4 months ago'],
    ['2024-09-13T12:00:00Z', 'opened 2 years ago', 'Opened 2 years ago'],
    // A clock behind GitHub's reads a Ticket from the future as just opened.
    ['2026-09-14T12:00:00Z', 'opened just now', 'Opened just now'],
  ] as const) {
    assert.deepEqual(ticketAge(createdAt, NOW), { short, long }, createdAt)
  }
})
