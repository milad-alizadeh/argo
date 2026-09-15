import assert from 'node:assert/strict'
import { appendFile, chmod, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { writeArchiveStore } from './session-fixture-files'
import { fixtureRoot, LATER_TURN } from './session-fixtures'

const listing = { version: 1, type: 'session.list', requestId: 'list-1', projectRoot: null }
const feed = {
  version: 1,
  type: 'session.feed',
  requestId: 'feed-1',
  sessionId: 'resumeParent',
  delegationId: null,
  revision: null,
}

function listSessions(value: unknown, root: string, archive?: string) {
  return createClaudeSessionReader({ transcripts: root, archive }).listSessions(value)
}

function readFeed(value: unknown, root: string) {
  return createClaudeSessionReader({ transcripts: root }).readSessionFeed(value)
}

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
// the CLI Session id. A Session archived under an id it has since retired is excluded from the
// active Roster under that id too (#1593), and a store that is not there at all is no archived
// Sessions rather than a failure.
test('excludes an archived Session from the Roster, under any id it answered to', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  await writeArchiveStore(store, ['resumeChild'])
  const reply = await listSessions(listing, root, store)
  assert.deepEqual(reply.sessions.map((session) => session.id).sort(), ['externalBasic'])
  const noStore = await listSessions(listing, root, `${store}/absent`)
  assert.deepEqual(noStore.sessions.map((session) => session.id).sort(), [
    'externalBasic',
    'resumeParent',
  ])
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

// A transcript can change while its Session is selected. The main-process reply names the whole
// projected document it read, so the renderer can measure a new reading before it reaches the
// scroller instead of treating new rows as an unmeasured DOM mutation.
test('changes the Feed revision when a transcript grows', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  const request = { ...feed, sessionId: 'externalBasic' }
  const reader = createClaudeSessionReader({ transcripts: root })
  const first = await reader.readSessionFeed(request)
  const unchanged = await reader.readSessionFeed({
    ...request,
    requestId: 'feed-unchanged',
    revision: first.revision,
  })
  assert.equal(unchanged.type, 'session.feed.unchanged')
  const file = path.join(root, 'project-one', 'externalBasic.jsonl')
  await appendFile(file, LATER_TURN)
  const second = await reader.readSessionFeed(request)
  assert.equal(first.type, 'session.feed.read')
  assert.equal(second.type, 'session.feed.read')
  assert.notEqual(second.revision, first.revision)
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
    cli: null,
    message: 'Argo cannot find this Session.',
  })
})

test('names a folder it cannot reach rather than reading as an empty machine', async (context) => {
  const root = await fixtureRoot(context, ['externalBasic'])
  assert.equal((await listSessions(listing, `${root}/absent`)).code, 'transcripts-unavailable')
  await chmod(root, 0o000)
  context.after(() => chmod(root, 0o700))
  assert.equal((await listSessions(listing, root)).code, 'access-denied')
})
