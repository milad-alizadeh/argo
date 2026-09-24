import assert from 'node:assert/strict'
import { appendFile, chmod, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { fixturePath, replaceInFile } from '../../../../mocks/sessions/mock-transcript-files'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'
import {
  fixtureRoot,
  LATER_TURN,
  unscopedListing as listing,
  listSessions,
} from './session-fixtures'

const feed = {
  version: 1,
  type: 'session.feed',
  requestId: 'feed-1',
  sessionId: 'resumeParent',
  subagentId: null,
  revision: null,
}

function readFeed(value: unknown, root: string) {
  return createSessionReader([claudeSessionSource({ transcripts: root })]).readSessionFeed(value)
}

test('discovers Sessions with no Project registration and states what it read', async (context) => {
  const root = await fixtureRoot(context, [
    'resumeParent',
    'resumeChild',
    '11111111-2222-4333-8444-555555555555',
  ])
  const reply = await listSessions(listing, root)
  assert.equal(reply.type, 'session.listed')
  assert.deepEqual({ found: reply.filesFound, read: reply.filesRead }, { found: 3, read: 3 })
  assert.equal(reply.filesUnreadable, 0)
  // Two Sessions from three files: the resume is one Session with the file it continued.
  assert.deepEqual(reply.sessions.map((session) => session.id).sort(), [
    '11111111-2222-4333-8444-555555555555',
    'resumeParent',
  ])
})

// The Harness records its cwd with symlinks resolved (macOS `/var` is `/private/var`), so a Project
// registered through a symlinked path still owns the Sessions started in it (#2204).
test('keeps a Session in a Project registered through a symlinked path', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-project-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  await mkdir(path.join(folder, 'real'))
  await symlink(path.join(folder, 'real'), path.join(folder, 'link'))
  await replaceInFile(
    fixturePath(root, '11111111-2222-4333-8444-555555555555'),
    '/Users/x/proj',
    await realpath(path.join(folder, 'real')),
  )
  const scoped = (projectRoot: string) => listSessions({ ...listing, projectRoot }, root)
  assert.deepEqual(
    (await scoped(path.join(folder, 'link'))).sessions.map((session) => session.id),
    ['11111111-2222-4333-8444-555555555555'],
  )
  assert.deepEqual((await scoped(path.join(folder, 'other'))).sessions, [])
})

test('puts the Session touched last at the top of the Roster', async (context) => {
  const root = await fixtureRoot(context, [
    'resumeParent',
    'resumeChild',
    '11111111-2222-4333-8444-555555555555',
  ])
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
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const request = { ...feed, sessionId: '11111111-2222-4333-8444-555555555555' }
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const first = await reader.readSessionFeed(request)
  const unchanged = await reader.readSessionFeed({
    ...request,
    requestId: 'feed-unchanged',
    revision: first.revision,
  })
  assert.equal(unchanged.type, 'session.feed.unchanged')
  const file = path.join(root, 'project-one', '11111111-2222-4333-8444-555555555555.jsonl')
  await appendFile(file, LATER_TURN)
  const second = await reader.readSessionFeed(request)
  assert.equal(first.type, 'session.feed.read')
  assert.equal(second.type, 'session.feed.read')
  assert.notEqual(second.revision, first.revision)
})

// One reader answers many Roster polls, and it stitches files into Sessions only when a file it
// read has changed (#2241). What the Roster says must still follow the transcripts.
test('follows a growing transcript across repeated Roster reads', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const first = await reader.listSessions(listing)
  const unchanged = await reader.listSessions({ ...listing, requestId: 'list-2' })
  assert.equal(first.type, 'session.listed')
  assert.equal(unchanged.type, 'session.listed')
  assert.deepEqual(unchanged.sessions, first.sessions)
  await appendFile(
    path.join(root, 'project-one', '11111111-2222-4333-8444-555555555555.jsonl'),
    LATER_TURN,
  )
  const grown = await reader.listSessions({ ...listing, requestId: 'list-3' })
  assert.equal(grown.type, 'session.listed')
  assert.notEqual(grown.sessions[0]?.updatedAt, first.sessions[0]?.updatedAt)
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
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const reply = await readFeed({ ...feed, sessionId: 'not-a-session' }, root)
  assert.deepEqual(reply, {
    version: 1,
    type: 'session.error',
    requestId: 'feed-1',
    code: 'missing-session',
    harness: null,
    message: 'This Session is unavailable from its Harness.',
  })
})

test('names a folder it cannot reach rather than reading as an empty machine', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  assert.equal((await listSessions(listing, `${root}/absent`)).code, 'transcripts-unavailable')
  await chmod(root, 0o000)
  context.after(() => chmod(root, 0o700))
  assert.equal((await listSessions(listing, root)).code, 'access-denied')
})
