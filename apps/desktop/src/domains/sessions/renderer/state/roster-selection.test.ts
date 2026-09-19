import { describe, expect, test } from 'bun:test'

import {
  clickSelection,
  EMPTY_ROSTER_SELECTION,
} from '@/domains/sessions/renderer/state/roster-selection'

const ORDER = ['a', 'b', 'c', 'd', 'e']

describe('clicking a roster row with a modifier key', () => {
  test('a plain click selects one row and replaces any prior selection', () => {
    const first = clickSelection(EMPTY_ROSTER_SELECTION, ORDER, { id: 'b', modifier: 'plain' })
    expect([...first.ids]).toEqual(['b'])
    const second = clickSelection(first, ORDER, { id: 'd', modifier: 'plain' })
    expect([...second.ids]).toEqual(['d'])
  })

  test('an additive click toggles one row into, and back out of, the set', () => {
    const selected = clickSelection(EMPTY_ROSTER_SELECTION, ORDER, { id: 'b', modifier: 'plain' })
    const added = clickSelection(selected, ORDER, { id: 'd', modifier: 'additive' })
    expect([...added.ids].sort()).toEqual(['b', 'd'])
    const removed = clickSelection(added, ORDER, { id: 'b', modifier: 'additive' })
    expect([...removed.ids]).toEqual(['d'])
  })

  test('a range click selects the inclusive span from the anchor', () => {
    const anchored = clickSelection(EMPTY_ROSTER_SELECTION, ORDER, { id: 'b', modifier: 'plain' })
    const ranged = clickSelection(anchored, ORDER, { id: 'd', modifier: 'range' })
    expect([...ranged.ids].sort()).toEqual(['b', 'c', 'd'])
  })

  test('a second range click from the same anchor replaces, not grows, the range', () => {
    const anchored = clickSelection(EMPTY_ROSTER_SELECTION, ORDER, { id: 'b', modifier: 'plain' })
    const wide = clickSelection(anchored, ORDER, { id: 'e', modifier: 'range' })
    const narrow = clickSelection(wide, ORDER, { id: 'c', modifier: 'range' })
    expect([...narrow.ids].sort()).toEqual(['b', 'c'])
  })

  test('a range click with no anchor yet ranges against itself', () => {
    const ranged = clickSelection(EMPTY_ROSTER_SELECTION, ORDER, { id: 'c', modifier: 'range' })
    expect([...ranged.ids]).toEqual(['c'])
  })

  test('a range click whose anchor has paged out of view degrades to that one row', () => {
    const anchored = { ids: new Set(['gone']), anchor: 'gone' }
    const ranged = clickSelection(anchored, ORDER, { id: 'c', modifier: 'range' })
    expect([...ranged.ids]).toEqual(['c'])
    expect(ranged.anchor).toBe('gone')
  })
})
