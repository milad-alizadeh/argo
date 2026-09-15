// Split from session-discover.test.ts to stay under the file-length gate: the reader's mtime-keyed
// per-transcript cache, proven directly through the reader's own listSessions interface.
import assert from 'node:assert/strict'
import { appendFile, utimes } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { writeFixtureTree } from './session-fixture-files'
import {
  fixtureRoot,
  LATER_TURN,
  unscopedListing as listing,
  listSessions,
} from './session-fixtures'

// Reading a Roster and then opening a Feed are two passes over the same tree, and only the
// parsing is kept between them. What is kept is keyed on the mtime it was read at, so a file
// written since is read again rather than answered from a summary of what it used to say.
test('re-reads a transcript that was written since the last pass', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const first = await listSessions(listing, root)
  assert.equal(first.sessions[0].updatedAt, '2026-07-20T10:00:05.000Z')

  const file = path.join(root, 'project-one', 'externalBasic.jsonl')
  await appendFile(file, LATER_TURN)
  const ahead = new Date(Date.now() + 2000)
  await utimes(file, ahead, ahead)

  const second = await listSessions(listing, root)
  assert.equal(second.sessions[0].updatedAt, '2026-09-01T08:00:00.000Z')
})

// The other half of the same fact, and the cost of it stated out loud: a file rewritten without
// its mtime moving is answered from the summary already held. This is what makes the second pass
// cheap, and it is the one thing that would go stale if the CLI ever wrote a transcript that way.
test('answers from the summary it holds while a file has not moved', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const file = path.join(root, 'project-one', 'externalBasic.jsonl')
  // Pinned to a whole second, so restoring it below restores it exactly: a filesystem stamp
  // carries more precision than a `Date` does, and a rounded one would read as a file that moved.
  const stamp = new Date(1_760_000_000_000)
  await utimes(file, stamp, stamp)
  await listSessions(listing, root)

  await appendFile(file, LATER_TURN)
  await utimes(file, stamp, stamp)

  const again = await listSessions(listing, root)
  assert.equal(again.sessions[0].updatedAt, '2026-07-20T10:00:05.000Z')
})

// The tree is listed every pass, so a Session written since the last one is found. Only the
// parsing of files that have not moved is reused.
test('finds a Session written since the last pass', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  assert.equal((await listSessions(listing, root)).sessions.length, 1)
  await writeFixtureTree(root, ['haltedTurn'], 'project-one')
  const reply = await listSessions(listing, root)
  assert.deepEqual(reply.sessions.map((session) => session.id).sort(), [
    'externalBasic',
    'haltedTurn',
  ])
})
