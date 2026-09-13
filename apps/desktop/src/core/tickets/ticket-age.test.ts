import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ticketAge } from './ticket-age'

const NOW = Date.parse('2026-09-13T12:00:00Z')

test('a Ticket reads its age in the largest whole unit it has passed', () => {
  for (const [createdAt, short, long] of [
    ['2026-09-13T11:59:30Z', 'now', 'Opened just now'],
    ['2026-09-13T11:15:00Z', '45m', 'Opened 45 minutes ago'],
    ['2026-09-13T11:00:00Z', '1h', 'Opened 1 hour ago'],
    ['2026-09-10T12:00:00Z', '3d', 'Opened 3 days ago'],
    ['2026-08-30T12:00:00Z', '2w', 'Opened 2 weeks ago'],
    ['2026-05-13T12:00:00Z', '4mo', 'Opened 4 months ago'],
    ['2024-09-13T12:00:00Z', '2y', 'Opened 2 years ago'],
    // A clock behind GitHub's reads a Ticket from the future as just opened.
    ['2026-09-14T12:00:00Z', 'now', 'Opened just now'],
  ] as const) {
    assert.deepEqual(ticketAge(createdAt, NOW), { short, long }, createdAt)
  }
})
