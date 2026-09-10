import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionClient } from '../sessions/client.ts'

const listing = { version: 1, type: 'session.list', requestId: 'list-1' }
const feed = { version: 1, type: 'session.feed', requestId: 'feed-1', sessionId: 'session-a' }

const listed = {
  version: 1,
  type: 'session.listed',
  requestId: 'list-1',
  sessions: [],
  filesFound: 0,
  filesRead: 0,
  filesUnreadable: 0,
}
const read = {
  version: 1,
  type: 'session.feed.read',
  requestId: 'feed-1',
  sessionId: 'session-a',
  chainId: 'session-a',
  rows: [{ shape: 'unreadable', id: 'unreadable:0:0' }],
}

function clientReturning(reply) {
  return createSessionClient(async () => reply)
}

test('passes a reply of the shape it asked for through', async () => {
  assert.deepEqual(await clientReturning(listed).listSessions(listing), listed)
  assert.deepEqual(await clientReturning(read).readSessionFeed(feed), read)
})

test('refuses a reply that answers a different request', async () => {
  const reply = await clientReturning({ ...listed, requestId: 'list-2' }).listSessions(listing)
  assert.equal(reply.code, 'invalid-response')
})

// A Feed drawn under the wrong name would show one Session's history as another's, so the id is
// checked rather than assumed. The chain id may differ; the echoed one may not.
test('refuses a Feed that answers for a different Session', async () => {
  const reply = await clientReturning({ ...read, sessionId: 'session-b' }).readSessionFeed(feed)
  assert.equal(reply.code, 'invalid-response')
  const followed = { ...read, chainId: 'session-origin' }
  assert.deepEqual(await clientReturning(followed).readSessionFeed(feed), followed)
})

test('refuses a reply that is not one of the shapes this contract holds', async () => {
  const cases = [
    { ...listed, sessions: [{ id: 'a' }] },
    { ...listed, filesRead: '3' },
    { ...read, rows: [{ shape: 'prose', id: 'a:0', role: 'narrator', text: 'x' }] },
    { ...read, rows: [{ shape: 'unfamiliar', id: 'a:0' }] },
    undefined,
    'a reply',
  ]
  for (const value of cases) {
    assert.equal((await clientReturning(value).readSessionFeed(feed)).code, 'invalid-response')
  }
})

test('names a lost connection, which the renderer can see no other way', async () => {
  const client = createSessionClient(async () => {
    throw new Error('the window went away')
  })
  assert.equal((await client.listSessions(listing)).code, 'connection-lost')
  assert.equal((await client.readSessionFeed(feed)).code, 'connection-lost')
})

test('passes an error reply through as itself', async () => {
  const error = {
    version: 1,
    type: 'session.error',
    requestId: 'list-1',
    code: 'access-denied',
    message: 'Argo cannot access these Sessions.',
  }
  assert.deepEqual(await clientReturning(error).listSessions(listing), error)
})
