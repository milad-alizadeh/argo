import { describe, expect, test } from 'vitest'
import type { RosterStatus } from '../../state/use-roster-filter-store'
import type { Session } from '../../types'
import { rosterRows } from './roster-rows'

const noArchive = {
  displayed: [] as Session[],
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
}

const someArchived = { ...noArchive, displayed: [{ id: 'archived-session' } as Session] }

function activeRoster(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `session-${index}` }) as Session)
}

function kindsOf(options: {
  archived?: typeof noArchive
  hasMoreSessions?: boolean
  isFetchingMoreSessions?: boolean
  showArchive?: boolean
  status?: RosterStatus
}) {
  return rosterRows({
    active: activeRoster(2),
    archived: noArchive,
    hasMoreSessions: false,
    isFetchingMoreSessions: false,
    showArchive: false,
    status: 'active',
    ...options,
  }).map((row) => row.kind)
}

describe('rosterRows', () => {
  test('ends on the paging sentinel while a wider window is available', () => {
    expect(kindsOf({ hasMoreSessions: true })).toEqual(['session', 'session', 'rosterSentinel'])
  })

  test('carries no paging rows once every Session is inside the window', () => {
    expect(kindsOf({ hasMoreSessions: false })).toEqual(['session', 'session'])
  })

  test('ends on the spinner row while a wider window is being read', () => {
    expect(kindsOf({ hasMoreSessions: true, isFetchingMoreSessions: true })).toEqual([
      'session',
      'session',
      'rosterSentinel',
      'rosterLoadingMore',
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
    const everyStatus: RosterStatus[] = ['active', 'archived', 'all']
    for (const status of everyStatus) {
      expect(kindsOf({ archived: someArchived, showArchive: true, status })).not.toContain(
        'archivedToggle',
      )
    }
  })

  test('says the Archive is empty under the archived filter rather than showing nothing', () => {
    expect(kindsOf({ showArchive: true, status: 'archived' })).toEqual(['archivedEmpty'])
  })
})
