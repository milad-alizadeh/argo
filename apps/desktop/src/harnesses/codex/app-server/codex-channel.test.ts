import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import { CodexRequestTimeoutError, openCodexChannel } from './codex-app-server-machine'

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
    channel.request('model/list', {}, (value) => value),
    (error: unknown) => error instanceof CodexRequestTimeoutError,
  )
})

test('resolves a request that gets an answer before its timeout', async () => {
  const process = silentProcess()
  const channel = openCodexChannel(process, 20)

  const request = channel.request('model/list', {}, (value) => value)
  process.stdout.write(`${JSON.stringify({ id: 1, result: { data: [] } })}\n`)

  assert.deepEqual(await request, { data: [] })
})

test('reports and counts an invalid protocol line while keeping the channel open', async () => {
  const process = silentProcess()
  const reports: unknown[] = []
  const channel = openCodexChannel(process, 20, (error) => reports.push(error))
  const request = channel.request('model/list', {}, (value) => value)
  process.stdout.write('{invalid JSON}\n')
  process.stdout.write(`${JSON.stringify({ id: 1, result: { data: [] } })}\n`)
  assert.deepEqual(await request, { data: [] })
  assert.equal(channel.invalidMessageCount(), 1)
  assert.equal(reports.length, 1)
  assert.match(String(reports[0]), /SyntaxError/)
})
