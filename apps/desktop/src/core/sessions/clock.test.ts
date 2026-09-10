import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compactAge, turnDuration } from './clock'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

test('reads a Turn to the second, and pads what follows the largest unit', () => {
  assert.equal(turnDuration(40 * SECOND), '40s')
  assert.equal(turnDuration(4 * MINUTE + 12 * SECOND), '4m 12s')
  assert.equal(turnDuration(4 * MINUTE + 2 * SECOND), '4m 02s')
  assert.equal(turnDuration(HOUR + 3 * MINUTE + 59 * SECOND), '1h 03m')
  assert.equal(turnDuration(23 * HOUR + 59 * MINUTE), '23h 59m')
  assert.equal(turnDuration(1227 * HOUR + 49 * MINUTE), '51d 03h')
})

test('reads an age to its largest unit only', () => {
  assert.equal(compactAge(40 * SECOND), '40s')
  assert.equal(compactAge(18 * MINUTE + 59 * SECOND), '18m')
  assert.equal(compactAge(HOUR + 59 * MINUTE), '1h')
  assert.equal(compactAge(3 * 24 * HOUR + HOUR), '3d')
})

test('reads a clock taken before its own start as zero, never a negative time', () => {
  assert.equal(turnDuration(-5 * SECOND), '0s')
  assert.equal(compactAge(-5 * MINUTE), '0s')
})
