import assert from 'node:assert/strict'
import { appendFile, copyFile, utimes } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  LATER_TURN as firstMessage,
  fixtureRoot,
  unscopedListing as listing,
  listSessions,
} from '@/harnesses/claude/integration/session-fixtures'
import { fixturePath } from '../../../../mocks/sessions/mock-transcript-files'

test('does not list transcripts without messages, but counts and re-reads them', async (context) => {
  const root = await fixtureRoot(context, [])
  const fixtures = path.join(
    import.meta.dir,
    '..',
    '..',
    '..',
    '..',
    'mocks',
    'cli',
    'claude',
    'fixtures',
    'sessions',
  )
  const empty = fixturePath(root, 'emptyTranscript')
  await copyFile(path.join(fixtures, 'emptyTranscript.jsonl'), empty)
  await copyFile(
    path.join(fixtures, 'nonMessageTranscript.jsonl'),
    fixturePath(root, 'nonMessageTranscript'),
  )

  const first = await listSessions(listing, root)
  assert.deepEqual(
    { found: first.filesFound, read: first.filesRead, sessions: first.sessions },
    { found: 2, read: 2, sessions: [] },
  )

  await appendFile(empty, firstMessage)
  const ahead = new Date(Date.now() + 2000)
  await utimes(empty, ahead, ahead)

  const second = await listSessions(listing, root)
  assert.deepEqual(
    {
      found: second.filesFound,
      read: second.filesRead,
      sessions: second.sessions.map((session) => session.id),
    },
    { found: 2, read: 2, sessions: ['emptyTranscript'] },
  )
})
