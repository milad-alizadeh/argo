// Recovery preserves sources of truth outside the disposable Session index (#2377).
import { rmSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { requestArchiveList } from '../../archive'
import { createSessionArchiveStore, sessionArchivePath } from '../../archive'
import { createSessionReader } from '../../observation'
import { feedRequest, listing } from '../../observation'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main'
import { openSessionIndex } from './open-index'
import {
  type IndexedAdapter,
  indexedAdapters,
  manyTranscripts,
  sessionIdAt,
} from './roster-fixtures'
import { rosterHarness } from './roster-harness'
import {
  createWorkerSessionIndex,
  type SessionIndexWorkerPort,
  SessionIndexWorkerStoppedError,
} from './worker-index'

const rosters = rosterHarness()
afterEach(rosters.cleanUp)

function indexPort(index: ReturnType<typeof openSessionIndex>): SessionIndexWorkerPort {
  return {
    call: (operation, args) => Reflect.apply(index[operation], index, args),
    close: () => index.close(),
  }
}

function testStoppedWorker(adapter: IndexedAdapter) {
  test('reports a stopped worker and recovers on the next read after restart', async () => {
    let databasePath = ''
    let starts = 0
    const listing = await rosters.listingWith(adapter, (path) => {
      databasePath = path
      return createWorkerSessionIndex(path, () => {
        starts += 1
        if (starts === 1) {
          return {
            call: async () => {
              throw new SessionIndexWorkerStoppedError()
            },
            close: async () => undefined,
          }
        }
        return indexPort(openSessionIndex(databasePath))
      })
    })
    await adapter.write(listing.root, manyTranscripts(3))
    const stopped = await listing.read()
    const recovered = await listing.read()
    expect(stopped.type).toBe('session.error')
    expect(recovered.type).toBe('session.listed')
    expect(recovered.type === 'session.listed' ? recovered.sessions : []).toHaveLength(3)
    expect(starts).toBe(2)
  })
}

async function connectTicketAndArchive(
  reader: ReturnType<typeof createSessionReader>,
  sessionId: string,
) {
  await reader.connectTicket({
    version: 1,
    type: 'session.ticket.connect',
    requestId: 'connect-before-recovery',
    sessionId,
    projectId: 'project-one',
    key: '#2377',
    title: 'Recover the Session index safely',
    state: 'open',
  })
  await reader.archiveSet({
    version: 1,
    type: 'session.archive.set',
    requestId: 'archive-before-recovery',
    sessionIds: [sessionId],
    archived: true,
  })
}

async function expectRecoveredAuthority(
  reader: ReturnType<typeof createSessionReader>,
  sessionId: string,
  before: Awaited<ReturnType<ReturnType<typeof createSessionReader>['readSessionFeed']>>,
) {
  const archived = await requestArchiveList(reader, { requestId: 'archive-after-recovery' })
  const restored = await reader.archiveSet({
    version: 1,
    type: 'session.archive.set',
    requestId: 'restore-after-recovery',
    sessionIds: [sessionId],
    archived: false,
  })
  const roster = await reader.listSessions(listing('list-after-recovery'))
  const after = await reader.readSessionFeed(feedRequest(sessionId, 'feed-after-recovery'))
  expect(archived.type === 'session.archive.listed' ? archived.sessions[0]?.id : null).toBe(
    sessionId,
  )
  expect(restored.type).toBe('session.archive.applied')
  expect(
    roster.type === 'session.listed'
      ? roster.sessions.find((session) => session.id === sessionId)?.ticket?.key
      : null,
  ).toBe('#2377')
  expect(after.type).toBe(before.type)
  expect(after.type === 'session.feed.read' ? after.rows : []).toEqual(
    before.type === 'session.feed.read' ? before.rows : [],
  )
}

function testDeletedIndex(adapter: IndexedAdapter) {
  test('loses no Session, archive choice, Ticket link or Feed when the index is deleted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `argo-index-recovery-${adapter.harness}-`))
    const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-index-recovery-user-data-'))
    const databasePath = path.join(root, 'sessions.db')
    const archive = createSessionArchiveStore(sessionArchivePath(userData))
    const ticketLinks = createInMemorySessionTicketLinkStore()
    const sessionId = sessionIdAt(1)
    let index = openSessionIndex(databasePath)
    try {
      await adapter.write(root, manyTranscripts(3))
      let reader = createSessionReader([adapter.source(root, index)], ticketLinks, archive)
      await reader.listSessions(listing('warm-index'))
      await connectTicketAndArchive(reader, sessionId)
      const before = await reader.readSessionFeed(feedRequest(sessionId, 'feed-before-recovery'))
      await index.close()
      rmSync(databasePath, { force: true })
      index = openSessionIndex(databasePath)
      reader = createSessionReader([adapter.source(root, index)], ticketLinks, archive)
      await expectRecoveredAuthority(reader, sessionId, before)
    } finally {
      await index.close()
      await rm(root, { recursive: true, force: true })
      await rm(userData, { recursive: true, force: true })
    }
  })
}

describe.each(indexedAdapters)(
  'the $harness reader preserving authority through recovery',
  (adapter) => {
    testStoppedWorker(adapter)
    testDeletedIndex(adapter)
  },
)
