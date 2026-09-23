import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import { CodexRequestTimeoutError, openCodexChannel } from './codex-channel'

function silentProcess() {
  return {
    stdout: new PassThrough(),
    write: () => {},
    kill: () => {},
    onExit: () => {},
  }
}

test('rejects a request the app-server never answers, instead of waiting forever (#2653)', async () => {
  const channel = openCodexChannel(silentProcess(), 20)

  await assert.rejects(
    channel.request('thread/list', {}, (value) => value),
    (error: unknown) => error instanceof CodexRequestTimeoutError,
  )
})

test('resolves a request that gets an answer before its timeout', async () => {
  const process = silentProcess()
  const channel = openCodexChannel(process, 20)

  const request = channel.request('thread/list', {}, (value) => value)
  process.stdout.write(`${JSON.stringify({ id: 1, result: { data: [] } })}\n`)

  assert.deepEqual(await request, { data: [] })
})
