import { describe, expect, it } from 'vitest'
import { clockTime, duration, relativeAge } from './sessionClock'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = 100 * DAY

// The formatting is date-fns'. What is worth asserting is the CONTRACT around it: which absences
// yield no reading at all, since every one of them would otherwise render as a fabricated fact.
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

// COMPACT, unlike `relativeAge` above: a duration only ever lands in a dense row — a subagent
// beside its name and its spend — where `12 minutes` costs three times the width of the fact and
// pushes the name it sits next to into an ellipsis.
describe('duration', () => {
  it('measures a finished span end to end, ignoring the wall clock', () => {
    expect(duration(NOW - 3 * HOUR, NOW - 2 * HOUR, NOW)).toBe('1h')
  })

  // The whole reason this takes a clock: a running agent HAS a duration, and it grows.
  it('measures a still-running span against the wall clock', () => {
    expect(duration(NOW - 12 * MINUTE, null, NOW)).toBe('12min')
  })

  // `min`, never `m`: `m` reads as minutes on a clock and as months in a formatter, and a subagent
  // row beside a token count is exactly where that ambiguity would land.
  it('spells minutes unambiguously and every other unit as one letter', () => {
    expect(duration(NOW - 45 * 1000, NOW, NOW)).toBe('45s')
    expect(duration(NOW - 5 * MINUTE, NOW, NOW)).toBe('5min')
    expect(duration(NOW - 2 * HOUR, NOW, NOW)).toBe('2h')
    expect(duration(NOW - 3 * 24 * HOUR, NOW, NOW)).toBe('3d')
  })

  it('claims no duration where the span never started', () => {
    expect(duration(null, NOW, NOW)).toBeNull()
  })

  it('claims no duration for an open span with no wall clock', () => {
    expect(duration(NOW - HOUR, null, null)).toBeNull()
  })

  it('claims no duration where the end precedes the start', () => {
    expect(duration(NOW, NOW - HOUR, NOW)).toBeNull()
  })
})

describe('clockTime', () => {
  // Built from LOCAL parts: the reading is the wall clock the person is sitting at, so an epoch
  // constant here would assert the machine's timezone rather than the formatting.
  it('names the hour and minute a moment landed', () => {
    expect(clockTime(new Date(2026, 6, 20, 14, 3).getTime())).toBe('14:03')
  })

  it('names no time where the record carries none', () => {
    expect(clockTime(null)).toBeNull()
  })
})
