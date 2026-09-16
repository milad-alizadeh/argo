// The Claude adapter's own bounded discovery (#2239): raw transcripts rather than the named
// fixture set, since these proofs need enough Sessions to cross ROSTER_PAGE_SIZE.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '@/core/sessions/discover-transcript-sessions'
import { createSessionReader } from '@/core/sessions/reader'
import { assertWindowGrowsToFarSession } from '@/core/sessions/window-proof-helpers'
import { writeArchiveStore } from '../../../../mocks/sessions/mock-transcript-files'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { claudeRoot, writeManySessions } from './session-window-fixture'

test('a Session outside the initial window is unread on first discovery, but reachable by growing the cursor or asking for it by id', async (context) => {
  const root = await claudeRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const farId = `s${ROSTER_PAGE_SIZE + 5}`
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])

  await assertWindowGrowsToFarSession(reader, farId)
})

// Page-size-bounded Archive discovery (#2239): the archive page grows the same bounded window
// discoverSessions pages by, only as far as it needs to fill one page.
test('pages the Archive within a bounded window rather than reading the whole tree per page', async (context) => {
  const root = await claudeRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-window-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  const archivedIds = Array.from({ length: ROSTER_PAGE_SIZE + 10 }, (_, index) => `s${index}`)
  await writeArchiveStore(store, archivedIds, { archived: true })
  const reader = createSessionReader([claudeSessionSource({ transcripts: root, archive: store })])

  const first = await reader.archiveList({
    version: 1,
    type: 'session.archive.list',
    requestId: 'archive-list-1',
    cursor: null,
    restoreId: null,
  })
  assert.equal(first.type, 'session.archive.listed')
  assert.ok(first.type === 'session.archive.listed' && first.sessions.length === 20)
  assert.ok(first.type === 'session.archive.listed' && first.nextCursor !== null)

  const second = await reader.archiveList({
    version: 1,
    type: 'session.archive.list',
    requestId: 'archive-list-2',
    cursor: first.type === 'session.archive.listed' ? first.nextCursor : null,
    restoreId: null,
  })
  assert.ok(second.type === 'session.archive.listed' && second.sessions.length === 20)
  const firstIds =
    first.type === 'session.archive.listed' ? first.sessions.map((row) => row.id) : []
  const secondIds =
    second.type === 'session.archive.listed' ? second.sessions.map((row) => row.id) : []
  assert.equal(new Set([...firstIds, ...secondIds]).size, firstIds.length + secondIds.length)
})
