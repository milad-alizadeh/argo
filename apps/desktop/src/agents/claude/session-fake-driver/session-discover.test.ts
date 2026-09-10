import assert from 'node:assert/strict'
import { appendFile, chmod, mkdtemp, rm, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { listSessions, readFeed } from '../sessions/read-sessions.ts'
import { writeArchiveStore, writeFixtureTree } from './session-fixture-files'
import { fixtureRoot } from './session-fixtures'

const listing = { version: 1, type: 'session.list', requestId: 'list-1' }
const feed = { version: 1, type: 'session.feed', requestId: 'feed-1', sessionId: 'resumeParent' }

test('discovers Sessions with no Project registration and states what it read', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const reply = await listSessions(listing, root)
  assert.equal(reply.type, 'session.listed')
  assert.deepEqual({ found: reply.filesFound, read: reply.filesRead }, { found: 3, read: 3 })
  assert.equal(reply.filesUnreadable, 0)
  // Two Sessions from three files: the resume is one Session with the file it continued.
  assert.deepEqual(reply.sessions.map((session) => session.id).sort(), [
    'externalBasic',
    'resumeParent',
  ])
})

// The archive flag is the Claude desktop app's own, read out of that app's store and joined on
// the CLI Session id. A Session archived under an id it has since retired stays archived, and a
// store that is not there at all is no archived Sessions rather than a failure.
test('reads the archive flag from the desktop store, under any id the Session answered to', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  await writeArchiveStore(store, ['resumeChild'])
  const reply = await listSessions(listing, root, store)
  assert.deepEqual(reply.sessions.map((session) => [session.id, session.archived]).sort(), [
    ['externalBasic', false],
    ['resumeParent', true],
  ])
  const noStore = await listSessions(listing, root, `${store}/absent`)
  assert.deepEqual(
    noStore.sessions.filter((session) => session.archived),
    [],
  )
})

test('puts the Session touched last at the top of the Roster', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const reply = await listSessions(listing, root)
  assert.deepEqual(
    reply.sessions.map((session) => session.updatedAt),
    ['2026-07-20T11:00:05.000Z', '2026-07-20T10:00:05.000Z'],
  )
})

test('reads a Feed for a whole Session, keyed by the Session that answered', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])
  const reply = await readFeed(feed, root)
  assert.equal(reply.type, 'session.feed.read')
  assert.equal(reply.chainId, 'resumeParent')
  assert.equal(reply.rows.length, 4)
})

// A retired id follows the chain that took it rather than reading as a Session that ended, and
// the reply carries both ids so the caller can still prove the answer is its own.
test('follows a retired id to the Session that took it', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])
  const reply = await readFeed({ ...feed, sessionId: 'resumeChild' }, root)
  assert.equal(reply.type, 'session.feed.read')
  assert.equal(reply.sessionId, 'resumeChild')
  assert.equal(reply.chainId, 'resumeParent')
})

test('says a Session is missing rather than answering with an empty Feed', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const reply = await readFeed({ ...feed, sessionId: 'not-a-session' }, root)
  assert.deepEqual(reply, {
    version: 1,
    type: 'session.error',
    requestId: 'feed-1',
    code: 'missing-session',
    message: 'Argo cannot find this Session.',
  })
})

test('refuses a request it cannot parse and a version it does not hold', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  assert.equal((await listSessions({ ...listing, extra: 1 }, root)).code, 'invalid-request')
  assert.equal((await listSessions({ ...listing, version: 2 }, root)).code, 'unsupported-version')
  assert.equal((await readFeed({ ...feed, sessionId: '' }, root)).code, 'invalid-request')
})

test('names a folder it cannot reach rather than reading as an empty machine', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  assert.equal((await listSessions(listing, `${root}/absent`)).code, 'transcripts-unavailable')
  await chmod(root, 0o000)
  context.after(() => chmod(root, 0o700))
  assert.equal((await listSessions(listing, root)).code, 'access-denied')
})

const LATER_TURN = `${JSON.stringify({
  type: 'assistant',
  uuid: 'e-a-2',
  parentUuid: 'e-a-1',
  timestamp: '2026-09-01T08:00:00.000Z',
  message: {
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'Done.' }],
  },
})}\n`

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
