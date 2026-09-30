import { expect, test } from 'bun:test'
import type { Session } from '../../types'
import { focusTarget } from './session-list-arrow-keys'
import type { SessionListRow } from './session-list-rows'

const session = (id: string): SessionListRow => ({
  kind: 'session',
  session: { id } as Session,
  archived: false,
})
const rows: SessionListRow[] = [
  session('first'),
  session('second'),
  { kind: 'sessionPlaceholder', index: 2 },
  { kind: 'sessionPlaceholder', index: 3 },
  { kind: 'archivedLoading' },
  { kind: 'session', session: { id: 'archived' } as Session, archived: true },
]

test('moves past the last loaded row onto the next unread list position', () => {
  expect(focusTarget(rows, 1, 'ArrowDown')).toBe(2)
})

test('skips status rows and stops at either end', () => {
  expect(focusTarget(rows, 3, 'ArrowDown')).toBe(5)
  expect(focusTarget(rows, 5, 'ArrowDown')).toBeNull()
  expect(focusTarget(rows, 0, 'ArrowUp')).toBeNull()
})

test('reaches the first and last list positions whether or not they are loaded', () => {
  expect(focusTarget(rows, 3, 'Home')).toBe(0)
  expect(focusTarget(rows.slice(0, 5), 0, 'End')).toBe(3)
})
