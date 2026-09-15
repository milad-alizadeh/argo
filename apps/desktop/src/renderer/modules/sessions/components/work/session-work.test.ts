import { expect, test } from 'bun:test'

import { compactTokens, workDuration } from './session-work.ts'

const STARTED = '2026-09-02T08:00:00.000Z'

test('reads a finished run as the time between its two stamps', () => {
  expect(workDuration(STARTED, '2026-09-02T08:00:12.000Z', Date.parse(STARTED))).toBe('12s')
  expect(workDuration(STARTED, '2026-09-02T08:03:30.000Z', Date.parse(STARTED))).toBe('3m 30s')
  expect(workDuration(STARTED, '2026-09-02T09:20:00.000Z', Date.parse(STARTED))).toBe('1h 20m')
})

test('reads a still-running run as the time since it started', () => {
  expect(workDuration(STARTED, null, Date.parse('2026-09-02T08:00:45.000Z'))).toBe('45s')
})

test('reads no duration where the start was never recorded', () => {
  expect(workDuration(null, '2026-09-02T08:01:00.000Z', Date.parse(STARTED))).toBe(null)
  expect(workDuration('not a time', null, Date.parse(STARTED))).toBe(null)
})

// A clock that ran backwards between two records would otherwise read as a negative duration.
test('reads an end before its start as no time at all', () => {
  expect(workDuration(STARTED, '2026-09-02T07:59:00.000Z', Date.parse(STARTED))).toBe('0s')
})

test('shortens a token count to the figure a reader scans', () => {
  expect(compactTokens(0)).toBe('0')
  expect(compactTokens(940)).toBe('940')
  expect(compactTokens(2700)).toBe('2.7k')
  expect(compactTokens(18_400)).toBe('18k')
  expect(compactTokens(1_240_000)).toBe('1.2M')
  expect(compactTokens(null)).toBe(null)
})
