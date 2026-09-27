import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'

import {
  type CodexProcess,
  CodexRequestTimeoutError,
  openCodexChannel,
} from './codex-app-server-client'

function silentProcess(): CodexProcess & { stdout: PassThrough } {
  return {
    stdout: new PassThrough(),
    write: (_line) => {},
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

test('refuses only server requests that no notification listener claims', () => {
  const writes: string[] = []
  const process = {
    ...silentProcess(),
    write: (line: string) => {
      writes.push(line)
    },
  }
  const channel = openCodexChannel(process)
  channel.onNotification(
    (message) => 'method' in message && message.method === 'item/tool/requestUserInput',
  )

  process.stdout.write(
    `${JSON.stringify({ id: 1, method: 'item/commandExecution/requestApproval', params: {} })}\n`,
  )
  process.stdout.write(
    `${JSON.stringify({ id: 2, method: 'item/tool/requestUserInput', params: {} })}\n`,
  )

  assert.equal(writes.length, 1)
  assert.deepEqual(JSON.parse(writes[0] ?? ''), {
    id: 1,
    error: {
      code: -32601,
      message: 'Argo does not answer item/commandExecution/requestApproval yet.',
    },
  })
})
