import { expect, test } from 'bun:test'
import type { SessionFeedRow } from '../types'
import { nextReveals } from './reveal'
import type { Settled } from './useSettledFeed'

function settled(rows: SessionFeedRow[], heights: Record<string, number>, width = 600): Settled {
  return {
    reading: { sessionId: 'thread', revision: 'r', width, font: 'body', zoom: 1 },
    rows,
    heights: new Map(Object.entries(heights)),
    measuredMs: 0,
    settledMs: 0,
  }
}

const reply = (text: string): SessionFeedRow => ({
  shape: 'prose',
  id: 'msg-1:0',
  role: 'assistant',
  text,
})

test('uncovers a growing draft from the height it was already shown at', () => {
  const first = nextReveals(null, settled([reply('Ducks')], { 'msg-1:0': 40 }))
  expect(first.reveals.size).toBe(0)
  const grown = nextReveals(first.shown, settled([reply('Ducks glide.')], { 'msg-1:0': 64 }))
  expect(grown.reveals.get('msg-1:0')).toEqual({ fromPx: 40, toPx: 64, durationMs: 250 })
})

test('reveals nothing when only the width changed', () => {
  const first = nextReveals(null, settled([reply('Ducks')], { 'msg-1:0': 40 }))
  const narrower = nextReveals(first.shown, settled([reply('Ducks')], { 'msg-1:0': 80 }, 300))
  expect(narrower.reveals.size).toBe(0)
})

test('caps how long a long reply takes to uncover', () => {
  const first = nextReveals(null, settled([], {}))
  const long = nextReveals(first.shown, settled([reply('A long reply.')], { 'msg-1:0': 5000 }))
  expect(long.reveals.get('msg-1:0')?.durationMs).toBe(1200)
})
