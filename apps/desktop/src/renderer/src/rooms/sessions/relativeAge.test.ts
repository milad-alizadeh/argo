import { describe, expect, it } from 'vitest'
import { relativeAge } from './relativeAge'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = 100 * DAY

// The formatting is date-fns'. What is worth asserting is the CONTRACT around it: which absences
// yield no age at all, since every one of them would otherwise render as a fabricated fact.
describe('relativeAge', () => {
  it('names the distance in the unit that fits it', () => {
    expect(relativeAge(NOW - 4 * MINUTE, NOW)).toBe('4 minutes')
    expect(relativeAge(NOW - 2 * HOUR, NOW)).toBe('2 hours')
    expect(relativeAge(NOW - 3 * DAY, NOW)).toBe('3 days')
  })

  it('claims no age where the record carries no timestamp', () => {
    expect(relativeAge(null, NOW)).toBeNull()
  })

  it('claims no age with no wall clock to measure against', () => {
    expect(relativeAge(NOW - HOUR, null)).toBeNull()
  })

  // A clock that disagrees with the record is not an age.
  it('claims no age for a timestamp in the future', () => {
    expect(relativeAge(NOW + HOUR, NOW)).toBeNull()
  })
})
