import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionStartRequestSchema } from '../../../domains/sessions/contract/contract.ts'
import { SESSION_OPERATIONS } from '../../../domains/sessions/contract/operations.ts'
import { createSessionClient } from '../../../domains/sessions/preload/client.ts'

const feed = {
  sessionId: 'session-a',
  delegationId: null,
  revision: null,
}

const listed = {
  version: 1,
  type: 'session.listed',
  sessions: [],
  filesFound: 0,
  filesRead: 0,
  filesUnreadable: 0,
  filesParsed: 0,
  nextCursor: null,
  historyComplete: true,
}
const read = {
  version: 1,
  type: 'session.feed.read',
  sessionId: 'session-a',
  chainId: 'session-a',
  revision: '1:row',
  rows: [{ shape: 'unreadable', id: 'unreadable:0:0' }],
}

function clientReturning(reply) {
  return createSessionClient(async (_channel, request) => ({
    ...reply,
    requestId: request.requestId,
  }))
}

test('passes a reply of the shape it asked for through', async () => {
  const listedReply = await clientReturning(listed).listSessions({ projectRoot: null })
  assert.deepEqual({ ...listedReply, requestId: undefined }, { ...listed, requestId: undefined })
  const feedReply = await clientReturning(read).readSessionFeed(feed)
  assert.deepEqual({ ...feedReply, requestId: undefined }, { ...read, requestId: undefined })
})

test('refuses a reply that answers a different request', async () => {
  const client = createSessionClient(async () => ({ ...listed, requestId: 'list-2' }))
  const reply = await client.listSessions({ projectRoot: null })
  assert.equal(reply.code, 'invalid-response')
})

// A Feed drawn under the wrong name would show one Session's history as another's, so the id is
// checked rather than assumed. The chain id may differ; the echoed one may not.
test('refuses a Feed that answers for a different Session', async () => {
  const reply = await clientReturning({ ...read, sessionId: 'session-b' }).readSessionFeed(feed)
  assert.equal(reply.code, 'invalid-response')
  const followed = { ...read, chainId: 'session-origin' }
  const result = await clientReturning(followed).readSessionFeed(feed)
  assert.deepEqual({ ...result, requestId: undefined }, { ...followed, requestId: undefined })
})

test('refuses a reply that is not one of the shapes this contract holds', async () => {
  const cases = [
    { ...listed, sessions: [{ id: 'a' }] },
    { ...listed, filesRead: '3' },
    { ...read, rows: [{ shape: 'prose', id: 'a:0', role: 'narrator', text: 'x' }] },
    { ...read, rows: [{ shape: 'unfamiliar', id: 'a:0' }] },
    { ...read, rows: [{ shape: 'thought', id: 'a:0', role: 'assistant', text: 'x' }] },
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
  assert.equal((await client.listSessions({ projectRoot: null })).code, 'connection-lost')
  assert.equal((await client.readSessionFeed(feed)).code, 'connection-lost')
})

test('passes an error reply through as itself', async () => {
  const error = {
    version: 1,
    type: 'session.error',
    code: 'access-denied',
    message: 'Argo cannot access these Sessions.',
  }
  const reply = await clientReturning(error).listSessions({ projectRoot: null })
  assert.deepEqual({ ...reply, requestId: undefined }, { ...error, requestId: undefined })
})

test('starts a managed Session through the named Session action', async () => {
  const request = {
    cli: 'claude',
    cwd: '/projects/argo',
    prompt: 'Inspect the failing test.',
    setup: { model: 'opus', effort: 'max', mode: 'plan' },
  } as const
  const reply = {
    version: 1,
    type: 'session.started',
    sessionId: 'managed-1',
  }
  const client = createSessionClient(async (channel, received) => {
    assert.equal(channel, SESSION_OPERATIONS.start.channel)
    const parsed = sessionStartRequestSchema.parse(received)
    assert.equal(parsed.cli, request.cli)
    assert.equal(parsed.cwd, request.cwd)
    assert.equal(parsed.prompt, request.prompt)
    assert.deepEqual(parsed.setup, request.setup)
    return { ...reply, requestId: parsed.requestId }
  })

  const result = await client.startSession(request)
  assert.deepEqual({ ...result, requestId: undefined }, { ...reply, requestId: undefined })
})
