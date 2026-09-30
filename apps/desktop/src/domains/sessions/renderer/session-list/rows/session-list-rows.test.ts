import { describe, expect, test } from 'vitest'
import { SessionContractError } from '../../session-contract-error'
import type { Session } from '../../types'
import type { SessionListStatus } from '../hooks/use-session-list-filter-store'
import { sameSessionListRow, sessionName } from './session-list-rows'
import {
  archiveFetchingMore,
  archiveWithMorePages,
  failedArchive,
  kindsOf,
  loadingArchive,
  someArchived,
} from './session-list-rows-test-fixtures'

function readFailure(requestId: string, message: string) {
  return new SessionContractError({
    version: 1,
    type: 'session.error',
    requestId,
    code: 'internal-error',
    message,
  })
}

describe('building the Session list rows for a status filter', () => {
  test('ends on the paging sentinel while a wider window is available', () => {
    expect(kindsOf({ hasMoreSessions: true })).toEqual([
      'session',
      'session',
      'sessionListSentinel',
    ])
  })

  test('carries no paging rows once every Session is inside the window', () => {
    expect(kindsOf({ hasMoreSessions: false })).toEqual(['session', 'session'])
  })

  test('ends on the spinner row while a wider window is being read', () => {
    expect(kindsOf({ hasMoreSessions: true, isFetchingMoreSessions: true })).toEqual([
      'session',
      'session',
      'sessionListSentinel',
      'sessionListLoadingMore',
    ])
  })

  test('carries only active Sessions under the active filter', () => {
    expect(kindsOf({ archived: someArchived, showArchive: true, status: 'active' })).toEqual([
      'session',
      'session',
    ])
  })

  test('drops the active Sessions under the archived filter', () => {
    expect(kindsOf({ archived: someArchived, showArchive: true, status: 'archived' })).toEqual([
      'session',
    ])
  })

  test('carries both under the all filter, active first', () => {
    expect(kindsOf({ archived: someArchived, showArchive: true, status: 'all' })).toEqual([
      'session',
      'session',
      'session',
    ])
  })

  // The Archive used to be reached by opening a disclosure row inside the list.
  test('carries no disclosure row for the Archive under any filter', () => {
    const everyStatus: SessionListStatus[] = ['active', 'archived', 'all']
    for (const status of everyStatus) {
      expect(kindsOf({ archived: someArchived, showArchive: true, status })).not.toContain(
        'archivedToggle',
      )
    }
  })
})

describe('building the Session list rows for the Archive', () => {
  test('says the Archive is empty under the archived filter rather than showing nothing', () => {
    expect(kindsOf({ showArchive: true, status: 'archived' })).toEqual(['archivedEmpty'])
  })

  test('shows the Archive spinner while its own read is in flight', () => {
    expect(kindsOf({ archived: loadingArchive, showArchive: true, status: 'archived' })).toEqual([
      'archivedLoading',
    ])
  })

  test('shows the Archive failure in place of its rows', () => {
    expect(kindsOf({ archived: failedArchive, showArchive: true, status: 'archived' })).toEqual([
      'archivedError',
    ])
  })

  test('ends the Archive on its own paging sentinel while a further page is available', () => {
    expect(
      kindsOf({ archived: archiveWithMorePages, showArchive: true, status: 'archived' }),
    ).toEqual(['session', 'archivedSentinel'])
  })

  test('ends the Archive on its own spinner while a further page is being read', () => {
    expect(
      kindsOf({ archived: archiveFetchingMore, showArchive: true, status: 'archived' }),
    ).toEqual(['session', 'archivedLoadingMore'])
  })

  test('carries no Archive rows at all until the Session list has resolved once', () => {
    expect(kindsOf({ archived: someArchived, showArchive: false, status: 'archived' })).toEqual([])
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
  const error = readFailure('test-archive-error', 'read failed')
  const otherError = readFailure('test-other-error', 'read failed again')

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

  test('reads two Archive failures carrying different errors as different rows', () => {
    expect(
      sameSessionListRow(
        { kind: 'archivedError', error },
        { kind: 'archivedError', error: otherError },
      ),
    ).toBe(false)
  })
})
