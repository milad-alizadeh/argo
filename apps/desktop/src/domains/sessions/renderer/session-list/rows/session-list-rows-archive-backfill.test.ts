import { describe, expect, test } from 'vitest'
import {
  archivedSoFarStillIndexing,
  archiveStillIndexing,
  kindsOf,
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
