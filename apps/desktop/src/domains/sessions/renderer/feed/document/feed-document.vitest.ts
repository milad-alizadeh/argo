import { expect, test } from 'vitest'
import type { SessionFeedRow } from '../../types'
import { promptBesideFeed } from './feed-document'

const prompt = (text: string, id = 'optimistic-turn:1'): SessionFeedRow => ({
  shape: 'prose',
  id,
  role: 'user',
  text,
})

test('keeps the optimistic prompt until the Feed has those words', () => {
  expect(promptBesideFeed([], prompt('Carry on after the restart.'), null)?.id).toBe(
    'optimistic-turn:1',
  )
})

test('drops the optimistic prompt once the Feed already shows it', () => {
  const shown = prompt('Carry on after the restart.', 'message-1')
  expect(promptBesideFeed([shown], prompt('Carry on after the restart.'), null)).toBeNull()
})
