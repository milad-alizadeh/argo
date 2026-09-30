import { describe, expect, test } from 'vitest'
import {
  archivedSoFarStillIndexing,
  archiveFetchingMore,
  archiveStillIndexing,
  kindsOf,
  loadingArchive,
} from './session-list-rows-test-fixtures'

describe('building the Session list rows for the Archive while backfill runs (#2374)', () => {
  test('says older history is still indexing rather than the Archive being empty', () => {
    expect(
      kindsOf({ archived: archiveStillIndexing, showArchive: true, status: 'archived' }),
    ).toEqual(['archivedIndexing'])
  })

  test('says older history is still indexing after the loaded rows once no page follows', () => {
    expect(
      kindsOf({ archived: archivedSoFarStillIndexing, showArchive: true, status: 'archived' }),
    ).toEqual(['session', 'archivedIndexing'])
  })

  test('lets the paging sentinel speak for a further page over the indexing row', () => {
    expect(
      kindsOf({
        archived: { ...archivedSoFarStillIndexing, hasNextPage: true },
        showArchive: true,
        status: 'archived',
      }),
    ).toEqual(['session', 'archivedSentinel'])
  })
})

describe('deduplicating the paging spinner between the Session list and the Archive (#2412)', () => {
  test('shows one spinner, not two, while the Session list and the Archive are both loading', () => {
    expect(
      kindsOf({
        archived: loadingArchive,
        hasMoreSessions: true,
        isFetchingMoreSessions: true,
        showArchive: true,
        status: 'all',
      }),
    ).toEqual(['session', 'session', 'sessionListSentinel', 'sessionListLoadingMore'])
  })

  test('shows one spinner, not two, while the Session list is paging and the Archive is paging too', () => {
    expect(
      kindsOf({
        archived: archiveFetchingMore,
        hasMoreSessions: true,
        isFetchingMoreSessions: true,
        showArchive: true,
        status: 'all',
      }),
    ).toEqual(['session', 'session', 'sessionListSentinel', 'sessionListLoadingMore', 'session'])
  })
})
