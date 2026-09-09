import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readMessage(line) {
  const message = JSON.parse(line)
  assert(object(message), 'Protocol envelope must be an object')
  const hasID = Object.hasOwn(message, 'id')
  if (hasID) {
    assert(['string', 'number'].includes(typeof message.id), 'Invalid protocol request ID')
  }
  if (Object.hasOwn(message, 'method')) {
    assert(
      typeof message.method === 'string' && message.method.length > 0,
      'Invalid protocol method',
    )
    assert(object(message.params), 'Protocol notification/request params must be an object')
    assert(
      !Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error'),
      'Mixed protocol envelope',
    )
  } else {
    assert(hasID, 'Protocol response is missing its ID')
    const hasResult = Object.hasOwn(message, 'result')
    assert(
      hasResult !== Object.hasOwn(message, 'error'),
      'Response needs exactly one result or error',
    )
    if (!hasResult) {
      assert(object(message.error), 'Protocol error must be an object')
      assert(Number.isInteger(message.error.code), 'Protocol error is missing its numeric code')
      assert.equal(typeof message.error.message, 'string', 'Protocol error is missing its message')
    }
  }
  return message
}

// A bounded live-probe client, not the desktop driver (#1826).
export function openChannel(executable, transcript) {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  const child = spawn(executable, ['app-server', '--listen', 'stdio://'], {
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const messages = []
  let sequence = 0
  let failure
  let closed = false
  let bytes = 0
  const record = (direction, message) => {
    const line = `${JSON.stringify({ direction, message })}\n`
    bytes += Buffer.byteLength(line)
    if (bytes > 8_000_000) throw new Error('Probe exceeded its 8 MB transcript bound')
    appendFileSync(transcript, line)
  }
  const lines = createInterface({ input: child.stdout })
  lines.on('line', (line) => {
    try {
      const message = readMessage(line)
      record('received', message)
      messages.push(message)
      if (message.method && message.id !== undefined) {
        throw new Error(`Unexpected server request: ${message.method}`)
      }
    } catch (error) {
      failure = error
      child.kill()
    }
  })
  child.stderr.on('data', () => {})
  child.on('error', (error) => {
    failure = error
  })
  child.stdin.on('error', (error) => {
    failure = error
  })
  child.on('close', () => {
    closed = true
  })

  async function waitFor(predicate) {
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      if (failure) throw failure
      const match = messages.find(predicate)
      if (match) return match
      if (closed) throw new Error('Codex exited before the expected response')
      await delay(20)
    }
    throw new Error('Codex did not answer within 45 seconds')
  }

  function send(message) {
    if (closed || failure) throw failure ?? new Error('Codex channel is closed')
    record('sent', message)
    child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  return {
    waitFor,
    notify(method) {
      send({ method })
    },
    async request(method, params) {
      const id = ++sequence
      send({ id, method, params })
      const response = await waitFor((message) => message.id === id && !message.method)
      if (response.error) throw new Error(JSON.stringify(response.error))
      return response.result
    },
    async close() {
      child.stdin.end()
      child.kill()
      const deadline = Date.now() + 5_000
      while (!closed && Date.now() < deadline) await delay(20)
      if (!closed) {
        child.kill('SIGKILL')
        throw new Error('Codex did not exit within five seconds')
      }
      lines.close()
    },
  }
}
