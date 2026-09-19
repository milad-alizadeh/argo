// Recovery is proved through the shared Session reader, the seam that owns adapter discovery.
import { rmSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, test } from 'vitest'
import { feedRequest } from '@/domains/sessions/main/reader-test-helpers'
import {
  type IndexedAdapter,
  indexedAdapters,
  manyTranscripts,
  sessionIdAt,
} from '@/domains/sessions/main/session-index/roster-fixtures'
import { rosterHarness } from '@/domains/sessions/main/session-index/roster-harness'

const rosters = rosterHarness()
afterEach(rosters.cleanUp)

function testInvalidRow(adapter: IndexedAdapter) {
  test('rebuilds an invalid stored row from its authoritative transcript', async () => {
    const { databasePath, root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(3))
    await list()
    const database = new DatabaseSync(databasePath)
    database
      .prepare('UPDATE session_chain SET row_json = ? WHERE cli = ? AND chain_id = ?')
      .run('{"not":"a Session row"}', adapter.cli, sessionIdAt(1))
    database.close()
    const recovered = await list()
    expect(recovered.sessions.map((session) => session.id)).toContain(sessionIdAt(1))
    expect(recovered.filesParsed).toBe(1)
  })
}

function testBusyFallback(adapter: IndexedAdapter) {
  test('falls back to bounded discovery while the database is busy', async () => {
    const { databasePath, root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(60))
    await list()
    const blocker = new DatabaseSync(databasePath)
    blocker.exec('BEGIN EXCLUSIVE')
    try {
      const fallback = await list()
      expect(fallback.sessions).toHaveLength(50)
      expect(fallback.filesParsed).toBe(50)
      expect(fallback.historyComplete).toBe(false)
    } finally {
      blocker.exec('ROLLBACK')
      blocker.close()
    }
  })
}

function testBusyAuthority(adapter: IndexedAdapter) {
  test('keeps archive writes and a selected Feed available while the database is busy', async () => {
    const { databasePath, reader, root, list } = await rosters.listing(adapter)
    const sessionId = sessionIdAt(1)
    await adapter.write(root, manyTranscripts(3))
    await list()
    const blocker = new DatabaseSync(databasePath)
    blocker.exec('BEGIN EXCLUSIVE')
    try {
      const archived = await reader.archiveSet({
        version: 1,
        type: 'session.archive.set',
        requestId: 'archive-during-recovery',
        sessionIds: [sessionId],
        archived: true,
      })
      const feed = await reader.readSessionFeed(feedRequest(sessionId, 'feed-during-recovery'))
      const restored = await reader.archiveSet({
        version: 1,
        type: 'session.archive.set',
        requestId: 'restore-during-recovery',
        sessionIds: [sessionId],
        archived: false,
      })
      expect(archived.type).toBe('session.archive.applied')
      expect(feed.type).toBe('session.feed.read')
      expect(restored.type).toBe('session.archive.applied')
    } finally {
      blocker.exec('ROLLBACK')
      blocker.close()
    }
  })
}

const unavailableIndexes = [
  { state: 'missing', breakIndex: (databasePath: string) => rmSync(databasePath, { force: true }) },
  {
    state: 'written by an unknown schema',
    breakIndex: (databasePath: string) => {
      const database = new DatabaseSync(databasePath)
      database.exec('PRAGMA user_version = 9999')
      database.close()
    },
  },
  {
    state: 'damaged',
    breakIndex: (databasePath: string) =>
      writeFileSync(databasePath, 'not a SQLite database', 'utf8'),
  },
]

function testUnavailableIndex(adapter: IndexedAdapter) {
  test.each(unavailableIndexes)(
    'returns a bounded incomplete window when the index is $state',
    async ({ breakIndex }) => {
      const first = await rosters.listing(adapter)
      await adapter.write(first.root, manyTranscripts(60))
      await first.list()
      await first.close()
      breakIndex(first.databasePath)
      const recovered = await rosters.reopen(adapter, first.root)
      const page = await recovered.list()
      expect(page.sessions).toHaveLength(50)
      expect(page.filesParsed).toBe(50)
      expect(page.historyComplete).toBe(false)
    },
  )
}

describe.each(indexedAdapters)('the $cli reader recovering its Session index', (adapter) => {
  testInvalidRow(adapter)
  testBusyFallback(adapter)
  testBusyAuthority(adapter)
  testUnavailableIndex(adapter)
})
