import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexReadiness } from './codex-readiness'

const found = () => '/usr/local/bin/codex'
const missing = () => null

test('Codex: no executable on the login PATH reads missing', async () => {
  const readiness = await codexReadiness({
    findExecutable: missing,
    runStatus: () => {
      throw new Error('never called')
    },
  })
  assert.deepEqual(readiness, { harness: 'codex', state: 'missing', detail: null })
})

test('Codex: "Logged in using ChatGPT" reads ready', async () => {
  const readiness = await codexReadiness({
    findExecutable: found,
    runStatus: async () => ({ stdout: 'Logged in using ChatGPT\n', stderr: '' }),
  })
  assert.deepEqual(readiness, { harness: 'codex', state: 'ready', detail: null })
})

test('Codex: "Not logged in" reads signed-out', async () => {
  const readiness = await codexReadiness({
    findExecutable: found,
    runStatus: async () => ({ stdout: '', stderr: 'Not logged in\n' }),
  })
  assert.deepEqual(readiness, { harness: 'codex', state: 'signed-out', detail: null })
})

test('Codex: an unrecognized failure reads signed-out, never a fabricated policy-blocked', async () => {
  const readiness = await codexReadiness({
    findExecutable: found,
    runStatus: async () => ({ stdout: '', stderr: 'error: could not reach auth server' }),
  })
  assert.deepEqual(readiness, {
    harness: 'codex',
    state: 'signed-out',
    detail: 'unrecognized-status',
  })
})
