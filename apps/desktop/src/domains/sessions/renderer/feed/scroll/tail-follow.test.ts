import { expect, test } from 'bun:test'
import { resolveInitialAtLatest } from './tail-follow'

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
