import { expect, test } from 'bun:test'
import type { SessionFeedRow } from '../types'
import { nextReveals } from './reveal'
import type { Settled } from './use-settled-feed'

function settled(rows: SessionFeedRow[]): Settled {
  return {
    reading: { sessionId: 'thread', revision: 'r' },
    rows,
  }
}

const reply = (text: string): SessionFeedRow => ({
  shape: 'prose',
  id: 'msg-1:0',
  role: 'assistant',
  text,
})

const toolRow: SessionFeedRow = { shape: 'prose', id: 'msg-2:0', role: 'assistant', text: 'Next.' }

test('uncovers a growing draft from its previous estimated text height', () => {
  const first = nextReveals(null, settled([reply('Ducks')]), 0)
  expect(first.reveals.size).toBe(0)
  const grown = nextReveals(first.shown, settled([reply('Ducks '.repeat(24))]), 0)
  expect(grown.reveals.get('msg-1:0')).toEqual({ fromPx: 24, toPx: 72, durationMs: 250 })
})

test('does not reveal an unchanged draft', () => {
  const first = nextReveals(null, settled([reply('Ducks')]), 0)
  const unchanged = nextReveals(first.shown, settled([reply('Ducks')]), 0)
  expect(unchanged.reveals.size).toBe(0)
})

test('caps how long a long reply takes to uncover', () => {
  const first = nextReveals(null, settled([]), 0)
  const long = nextReveals(first.shown, settled([reply('x'.repeat(10_000))]), 0)
  expect(long.reveals.get('msg-1:0')?.durationMs).toBe(1200)
})

test('lets a reveal play to its end when another row arrives under it', () => {
  const first = nextReveals(null, settled([]), 0)
  const arrived = nextReveals(first.shown, settled([reply('x'.repeat(10_000))]), 0)
  const during = nextReveals(arrived.shown, settled([reply('x'.repeat(10_000)), toolRow]), 500)
  expect(during.reveals.get('msg-1:0')).toBe(arrived.reveals.get('msg-1:0'))
  const after = nextReveals(during.shown, settled([reply('x'.repeat(10_000)), toolRow]), 1300)
  expect(after.reveals.has('msg-1:0')).toBe(false)
})
