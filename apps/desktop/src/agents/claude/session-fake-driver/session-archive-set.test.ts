import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '../../../core/sessions/reader.ts'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { writeArchiveStore } from './session-fixture-files'
import { fixtureRoot, unscopedListing as listing, listSessions } from './session-fixtures'

// Bulk archive (#2194) writes into the same store the read joins on, changing only `isArchived`
// and carrying every other key over untouched: `sessionId` here proves the desktop app's own id
// survives the round trip.
test("archives a Session by writing the flag back into the Claude desktop app's store", async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  await writeArchiveStore(store, ['resumeChild'], { archived: false })
  const reader = createSessionReader([claudeSessionSource({ transcripts: root, archive: store })])
  const applied = await reader.archiveSet({
    version: 1,
    type: 'session.archive.set',
    requestId: 'archive-set-1',
    sessionIds: ['resumeChild'],
    archived: true,
  })
  assert.deepEqual(applied, {
    version: 1,
    type: 'session.archive.applied',
    requestId: 'archive-set-1',
    archived: true,
    applied: ['resumeChild'],
    failed: [],
  })
  const file = path.join(store, 'workspace-one', 'project-one', 'local_resumeChild.json')
  const written = JSON.parse(await readFile(file, 'utf8'))
  assert.deepEqual(written, {
    sessionId: 'desktop-resumeChild',
    cliSessionId: 'resumeChild',
    isArchived: true,
  })
  const after = await listSessions(listing, root, store)
  assert.deepEqual(after.sessions.map((session) => session.id).sort(), [])
})

// A Session the store names nothing for at all — never opened in Claude Desktop — comes back
// failed rather than the write inventing a file whose location and shape it cannot ground.
test('fails a bulk archive for a Session the store has no row for', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent'])
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  const reader = createSessionReader([claudeSessionSource({ transcripts: root, archive: store })])
  const applied = await reader.archiveSet({
    version: 1,
    type: 'session.archive.set',
    requestId: 'archive-set-2',
    sessionIds: ['resumeParent'],
    archived: true,
  })
  assert.deepEqual(applied.applied, [])
  assert.deepEqual(applied.failed, ['resumeParent'])
})
