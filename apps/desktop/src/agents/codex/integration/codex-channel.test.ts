import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import { openCodexChannel } from '../drive/codex-channel.ts'

function mockProcess() {
  const stdout = new PassThrough()
  const writes: string[] = []
  const exitListeners: Array<() => void> = []
  return {
    stdout,
    writes,
    process: {
      stdout,
      write: (line: string) => writes.push(line),
      kill: () => {},
      onExit: (listener: () => void) => exitListeners.push(listener),
    },
    emitLine: (line: string) => stdout.write(`${line}\n`),
    exit: () => {
      for (const listener of exitListeners) listener()
    },
  }
}

test('resolves a request once its matching JSON-RPC result arrives', async () => {
  const mock = mockProcess()
  const channel = openCodexChannel(mock.process)

  const pending = channel.request('thread/start', { cwd: '/projects/argo' }, (value) => value)
  const sent = JSON.parse(mock.writes[0] as string)
  assert.equal(sent.method, 'thread/start')
  mock.emitLine(JSON.stringify({ id: sent.id, result: { thread: { id: 'thread-1' } } }))

  assert.deepEqual(await pending, { thread: { id: 'thread-1' } })
})

test('rejects a request when its matching JSON-RPC error arrives', async () => {
  const mock = mockProcess()
  const channel = openCodexChannel(mock.process)

  const pending = channel.request(
    'turn/interrupt',
    { threadId: 't', turnId: 'u' },
    (value) => value,
  )
  const sent = JSON.parse(mock.writes[0] as string)
  mock.emitLine(JSON.stringify({ id: sent.id, error: { code: -32000, message: 'boom' } }))

  await assert.rejects(pending, /boom/)
})

test('refuses an unhandled server request instead of leaving it unanswered', () => {
  const mock = mockProcess()
  openCodexChannel(mock.process)

  mock.emitLine(JSON.stringify({ id: 9, method: 'approval/exec', params: {} }))

  const refusal = JSON.parse(mock.writes[0] as string)
  assert.deepEqual(refusal, {
    id: 9,
    error: { code: -32601, message: 'Argo does not answer approval/exec yet.' },
  })
})

test('delivers a notification with no ID to every listener without refusing it', () => {
  const mock = mockProcess()
  const channel = openCodexChannel(mock.process)
  const received: unknown[] = []
  channel.onNotification((message) => received.push(message))

  mock.emitLine(JSON.stringify({ method: 'turn/completed', params: { threadId: 't' } }))

  assert.equal(mock.writes.length, 0)
  assert.equal(received.length, 1)
})

test('rejects every pending request when the process exits', async () => {
  const mock = mockProcess()
  const channel = openCodexChannel(mock.process)

  const pending = channel.request('thread/start', { cwd: '/projects/argo' }, (value) => value)
  mock.exit()

  await assert.rejects(pending, /exited/)
})
