import { describe, expect, test } from 'vitest'
import type { Session } from '../../types'
import { sameSessionListRow, sessionListRows, sessionName } from './session-list-rows'

function kindsOf(options: { hasMoreSessions?: boolean; isFetchingMoreSessions?: boolean }) {
  const sessions = [{ id: 'session-0' }, { id: 'session-1', archived: true }] as Session[]
  return sessionListRows({
    sessions,
    hasMoreSessions: false,
    isFetchingMoreSessions: false,
    ...options,
  }).map((row) => (row.kind === 'session' ? `session${row.archived ? ' archived' : ''}` : row.kind))
}

describe('building the Session list rows', () => {
  test('marks each row archived as its Session is', () => {
    expect(kindsOf({})).toEqual(['session', 'session archived'])
  })

  test('ends on the paging sentinel while more Sessions are available', () => {
    expect(kindsOf({ hasMoreSessions: true })).toEqual([
      'session',
      'session archived',
      'sessionListSentinel',
    ])
  })

  test('ends on the spinner row while the next page is read', () => {
    expect(kindsOf({ hasMoreSessions: true, isFetchingMoreSessions: true })).toEqual([
      'session',
      'session archived',
      'sessionListSentinel',
      'sessionListLoadingMore',
    ])
  })
})

describe('naming a Session', () => {
  test.each([
    {
      name: 'a titled Session reads its title',
      status: 'running',
      title: 'Fix the login bug',
      expected: 'Fix the login bug',
    },
    {
      name: 'a starting Session with no title reads the starting label',
      status: 'starting',
      title: null,
      expected: 'New Session',
    },
    {
      name: 'another untitled Session reads its id',
      status: 'idle',
      title: null,
      expected: 'session-1',
    },
  ] as const)('$name', ({ status, title, expected }) => {
    const named = title === null ? null : { text: title, source: 'first-prompt' as const }
    expect(sessionName({ id: 'session-1', status, title: named }, 'New Session')).toBe(expected)
  })
})

describe('deciding whether a Session list row is the same row across a rebuild', () => {
  const session = { id: 'session-1' } as Session

  test('reads a rebuilt row object carrying one Session as the same row', () => {
    expect(
      sameSessionListRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: false },
      ),
    ).toBe(true)
  })

  test('reads a Session the read changed as a different row', () => {
    expect(
      sameSessionListRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session: { ...session }, archived: false },
      ),
    ).toBe(false)
  })

  test('reads a Session that moved into the Archive as a different row', () => {
    expect(
      sameSessionListRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: true },
      ),
    ).toBe(false)
  })

  test('reads two status rows of one kind as the same row', () => {
    expect(
      sameSessionListRow({ kind: 'sessionListSentinel' }, { kind: 'sessionListSentinel' }),
    ).toBe(true)
  })

  test('reads two status rows of different kinds as different rows', () => {
    expect(
      sameSessionListRow({ kind: 'sessionListSentinel' }, { kind: 'sessionListLoadingMore' }),
    ).toBe(false)
  })
})
