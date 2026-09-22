import { expect, test } from 'bun:test'
import { advanceVisibleText } from '@/domains/sessions/renderer/feed/streaming-text'

const start = { text: '', progress: 0 }

test('advances toward the target at a steady, readable pace', () => {
  // Six words is under the lag ceiling for the fixed rate, so this reveals at the plain
  // words-per-second pace rather than the catch-up rate.
  const target = 'One two three four five six.'
  const first = advanceVisibleText(start, target, 0.5)
  expect(first.progress).toBeCloseTo(4, 1)
  expect(first.text).toBe('One two three four ')
  const second = advanceVisibleText(first, target, 0.5)
  expect(second.progress).toBeCloseTo(6, 1)
  expect(second.text).toBe(target)
})

test('never runs ahead of the target', () => {
  const target = 'Only three words.'
  const shown = advanceVisibleText(start, target, 10)
  expect(shown.text).toBe(target)
  expect(shown.progress).toBe(3)
})

test('lifts the reveal rate to close a large gap within the lag ceiling', () => {
  const target = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')
  const shown = advanceVisibleText(start, target, 0.8)
  expect(shown.progress).toBeCloseTo(40, 1)
})

test('snaps immediately when the target no longer extends what was shown', () => {
  const shown = advanceVisibleText({ text: 'Old draft text.', progress: 3 }, 'Replaced.', 0)
  expect(shown.text).toBe('Replaced.')
  expect(shown.progress).toBe(1)
})

test('holds position across a zero-length frame', () => {
  const target = 'One two three.'
  const first = advanceVisibleText(start, target, 0.5)
  const held = advanceVisibleText(first, target, 0)
  expect(held).toEqual(first)
})
