import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readInterrupt } from '../drive/protocol/interrupt-protocol'
import { readMessage, readStartedTurn, readThreadId } from '../drive/protocol/protocol'
import { readCompletedTurn, readThreadStatus } from '../drive/protocol/protocol-notifications'

test('parses a JSON-RPC result response', () => {
  const message = readMessage('{"id":1,"result":{"thread":{"id":"thread-1"}}}')
  assert.deepEqual(message, { id: 1, result: { thread: { id: 'thread-1' } } })
})

test('parses a JSON-RPC error response', () => {
  const message = readMessage('{"id":2,"error":{"code":-32601,"message":"unsupported"}}')
  assert.deepEqual(message, { id: 2, error: { code: -32601, message: 'unsupported' } })
})

test('parses a server notification with no ID', () => {
  const message = readMessage(
    '{"method":"turn/completed","params":{"threadId":"thread-1","turn":{"id":"turn-1","status":"completed"}}}',
  )
  assert.deepEqual(message, {
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
    id: undefined,
  })
})

test('rejects a response naming both a result and an error', () => {
  assert.throws(() => readMessage('{"id":1,"result":{},"error":{"code":1,"message":"x"}}'))
})

test('reads the thread ID out of a thread/start result', () => {
  assert.equal(readThreadId({ thread: { id: 'thread-1' } }), 'thread-1')
})

test('reads a started Turn', () => {
  assert.deepEqual(readStartedTurn({ turn: { id: 'turn-1', status: 'inProgress', error: null } }), {
    id: 'turn-1',
    status: 'inProgress',
    error: null,
  })
})

test('reads a completed-Turn notification, and ignores any other notification', () => {
  const completed = readCompletedTurn({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'failed', error: 'boom' } },
  })
  assert.deepEqual(completed, {
    threadId: 'thread-1',
    turn: { id: 'turn-1', status: 'failed', error: 'boom' },
  })

  assert.equal(
    readCompletedTurn({ method: 'thread/status/changed', params: { threadId: 'thread-1' } }),
    undefined,
  )
})

test('reads the thread status envelope, leaving what it means to the status rollup', () => {
  assert.deepEqual(
    readThreadStatus({
      method: 'thread/status/changed',
      params: {
        threadId: 'thread-1',
        status: { type: 'active', activeFlags: [] },
      },
    }),
    { threadId: 'thread-1', status: { type: 'active', activeFlags: [] } },
  )
  assert.deepEqual(
    readThreadStatus({
      method: 'thread/status/changed',
      params: { threadId: 'thread-1', status: { type: 'idle' } },
    }),
    { threadId: 'thread-1', status: { type: 'idle' } },
  )
  assert.throws(() =>
    readThreadStatus({
      method: 'thread/status/changed',
      params: { threadId: 'thread-1', status: { type: 'active', activeFlags: [false] } },
    }),
  )
})

test('reads an empty interrupt result and rejects a populated one', () => {
  assert.doesNotThrow(() => readInterrupt({}))
  assert.throws(() => readInterrupt({ turnId: 'turn-1' }))
})
