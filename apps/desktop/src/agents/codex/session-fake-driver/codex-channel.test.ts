import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import { openCodexChannel } from '../drive/codex-channel.ts'

function fakeProcess() {
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
  const fake = fakeProcess()
  const channel = openCodexChannel(fake.process)

  const pending = channel.request('thread/start', { cwd: '/projects/argo' }, (value) => value)
  const sent = JSON.parse(fake.writes[0] as string)
  assert.equal(sent.method, 'thread/start')
  fake.emitLine(JSON.stringify({ id: sent.id, result: { thread: { id: 'thread-1' } } }))

  assert.deepEqual(await pending, { thread: { id: 'thread-1' } })
})

test('rejects a request when its matching JSON-RPC error arrives', async () => {
  const fake = fakeProcess()
  const channel = openCodexChannel(fake.process)

  const pending = channel.request('turn/interrupt', { threadId: 't', turnId: 'u' }, (value) => value)
  const sent = JSON.parse(fake.writes[0] as string)
  fake.emitLine(JSON.stringify({ id: sent.id, error: { code: -32000, message: 'boom' } }))

  await assert.rejects(pending, /boom/)
})

test('refuses an unhandled server request instead of leaving it unanswered', () => {
  const fake = fakeProcess()
  openCodexChannel(fake.process)

  fake.emitLine(JSON.stringify({ id: 9, method: 'approval/exec', params: {} }))

  const refusal = JSON.parse(fake.writes[0] as string)
  assert.deepEqual(refusal, {
    id: 9,
    error: { code: -32601, message: 'Argo does not answer approval/exec yet.' },
  })
})

test('delivers a notification with no ID to every listener without refusing it', () => {
  const fake = fakeProcess()
  const channel = openCodexChannel(fake.process)
  const received: unknown[] = []
  channel.onNotification((message) => received.push(message))

  fake.emitLine(JSON.stringify({ method: 'turn/completed', params: { threadId: 't' } }))

  assert.equal(fake.writes.length, 0)
  assert.equal(received.length, 1)
})

test('rejects every pending request when the process exits', async () => {
  const fake = fakeProcess()
  const channel = openCodexChannel(fake.process)

  const pending = channel.request('thread/start', { cwd: '/projects/argo' }, (value) => value)
  fake.exit()

  await assert.rejects(pending, /exited/)
})
