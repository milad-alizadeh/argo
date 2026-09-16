import { expect, test } from 'bun:test'

import { adversarialTurn, adversarialTurnsForSeed } from './adversarial-turns'

test('the same seed plans the same adversarial turns', () => {
  expect(adversarialTurnsForSeed('portable-journey')).toEqual(
    adversarialTurnsForSeed('portable-journey'),
  )
})

test('different seeds select different adversarial behavior', () => {
  expect(adversarialTurnsForSeed('first-seed')).not.toEqual(adversarialTurnsForSeed('second-seed'))
})

test('each planned reply waits inside the jitter range and splits a multi-byte reply', () => {
  for (const turn of adversarialTurnsForSeed('split-reply')) {
    expect(turn.firstReplyDelayMs).toBeGreaterThanOrEqual(25)
    expect(turn.firstReplyDelayMs).toBeLessThanOrEqual(125)
    expect(turn.replySplitByte).toBeGreaterThan(0)
  }
})

test('a seed plans each terminal behavior and the queued Permission', () => {
  const turns = adversarialTurnsForSeed('all-behaviors')
  expect(turns.map((turn) => turn.outcome)).toEqual(
    expect.arrayContaining(['reply', 'failure', 'stall']),
  )
  expect(turns.some((turn) => turn.permissionBeforeReply)).toBe(true)
})

test('turn numbering repeats after the seed plan ends', () => {
  const turns = adversarialTurnsForSeed('repeatable')
  expect(adversarialTurn('repeatable', turns.length)).toEqual(turns[0])
})
