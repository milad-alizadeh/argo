import { expect, test } from 'bun:test'
import { resolveAtLatest, resolveInitialAtLatest } from './tail-follow'

test('a restored position the virtualizer measures at the tail is treated as latest', () => {
  expect(resolveInitialAtLatest(false, true)).toBe(true)
})

test('a restored position away from the tail stays away from latest', () => {
  expect(resolveInitialAtLatest(false, false)).toBe(false)
})

test('a fresh session with no restored position is latest before any measurement', () => {
  expect(resolveInitialAtLatest(true, null)).toBe(true)
})

test('a restored position with no measurement yet defers to the restored flag', () => {
  expect(resolveInitialAtLatest(false, null)).toBe(false)
})

test('remeasurement does not stop an existing tail follower', () => {
  expect(resolveAtLatest(true, false, null)).toBe(true)
})

test('scrolling backward beyond the threshold stops following', () => {
  expect(resolveAtLatest(true, false, 'backward')).toBe(false)
})

test('scrolling forward to a sent prompt away from the tail stops following', () => {
  expect(resolveAtLatest(true, false, 'forward')).toBe(false)
})

test('remeasurement does not pull a history reader to the tail', () => {
  expect(resolveAtLatest(false, false, null)).toBe(false)
  expect(resolveAtLatest(false, false, 'forward')).toBe(false)
})

test('returning within the tail threshold resumes following', () => {
  expect(resolveAtLatest(false, true, 'forward')).toBe(true)
  expect(resolveAtLatest(true, true, 'backward')).toBe(true)
})
