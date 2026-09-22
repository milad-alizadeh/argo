import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive/archive-store'
import { createSessionReader } from '@/domains/sessions/main/observation/reader.ts'
import { claudeSessionSource } from '../sessions/read-sessions.ts'
import { fixtureRoot, unscopedListing as listing } from './session-fixtures'

// The shared reader joins an Argo archive flag with the Session's current and retired ids (#2315).
test('excludes an archived Session from the Roster, under any id it answered to', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  const archive = createSessionArchiveStore(sessionArchivePath(store))
  await archive.setArchived(['resumeChild'], true)
  const reader = createSessionReader(
    [claudeSessionSource({ transcripts: root })],
    undefined,
    archive,
  )

  const reply = await reader.listSessions(listing)

  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(
    reply.type === 'session.listed' ? reply.sessions.map((session) => session.id).sort() : [],
    ['externalBasic'],
  )
})
