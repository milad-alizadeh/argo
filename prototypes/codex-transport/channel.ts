import { spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'
import type { RequestID, RequestParams, WireMessage } from './protocol.ts'
import { readMessage } from './protocol.ts'

// A bounded live-probe client, not the desktop driver (#1826).
export function openChannel(executable: string, transcript: string) {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  const child = spawn(executable, ['app-server', '--listen', 'stdio://'], {
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const messages: WireMessage[] = []
  let sequence = 0
  let failure: unknown
  let closed = false
  let bytes = 0
  const record = (direction: 'sent' | 'received', message: unknown) => {
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
      if ('method' in message && message.id !== undefined) {
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

  async function waitFor<Result>(select: (message: WireMessage) => Result | undefined) {
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      if (failure) throw failure
      for (const message of messages) {
        const match = select(message)
        if (match !== undefined) return match
      }
      if (closed) throw new Error('Codex exited before the expected response')
      await delay(20)
    }
    throw new Error('Codex did not answer within 45 seconds')
  }

  function send(message: { id?: RequestID; method: string; params?: unknown }) {
    if (closed || failure) throw failure ?? new Error('Codex channel is closed')
    record('sent', message)
    child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  return {
    waitFor,
    notify(method: 'initialized') {
      send({ method })
    },
    async request<Method extends keyof RequestParams, Result>(
      method: Method,
      params: RequestParams[Method],
      decode: (value: unknown) => Result,
    ) {
      const id = ++sequence
      send({ id, method, params })
      const response = await waitFor((message) =>
        message.id === id && !('method' in message) ? message : undefined,
      )
      if ('error' in response) throw new Error(JSON.stringify(response.error))
      return decode(response.result)
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

export type Channel = ReturnType<typeof openChannel>
