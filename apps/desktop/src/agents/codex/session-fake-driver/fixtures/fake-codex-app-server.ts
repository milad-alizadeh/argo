// A minimal stand-in for `codex app-server --listen stdio://`, run as a real child process so the
// vertical-slice test in codex-vertical-slice.test.ts exercises the real pipes and NDJSON framing
// this adapter depends on, not just an in-memory fake of `CodexChannel`. It answers exactly the
// verbs `codex-session-driver.ts` sends, grounded in codex-cli 0.147.0's schema
// (docs/research/2026-09-09-codex-transport.md).

import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'

let threadCounter = 0

function recordTurn(threadId: string, text: string) {
  const transcripts = process.env.ARGO_CODEX_TRANSCRIPTS
  if (transcripts === undefined) return
  const day = path.join(transcripts, '2026', '09', '14')
  mkdirSync(day, { recursive: true })
  const transcript = path.join(day, `rollout-2026-09-14T15-17-11-${threadId}.jsonl`)
  appendFileSync(
    transcript,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'event_msg',
      payload: {
        type: 'user_message',
        message: text,
      },
    })}\n`,
  )
}

function send(message: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function request(line: string) {
  return JSON.parse(line) as { id?: unknown; method?: string; params?: Record<string, unknown> }
}

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const message = request(line)
  if (message.method === undefined) return
  switch (message.method) {
    case 'initialize':
      send({ id: message.id, result: {} })
      return
    case 'initialized':
      return
    case 'thread/start': {
      threadCounter += 1
      send({ id: message.id, result: { thread: { id: `fake-thread-${threadCounter}` } } })
      return
    }
    case 'thread/resume': {
      const threadId = message.params?.threadId
      send({ id: message.id, result: { thread: { id: threadId } } })
      return
    }
    case 'turn/start': {
      const params = message.params ?? {}
      const threadId = params.threadId
      const input = Array.isArray(params.input) ? params.input : []
      const text = typeof input[0]?.text === 'string' ? input[0].text : ''
      if (typeof threadId === 'string') recordTurn(threadId, text)
      const turnId = `fake-turn-${threadCounter}-${Date.now()}`
      send({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
      send({
        method: 'thread/status/changed',
        params: { threadId, status: { type: 'active', activeFlags: [] } },
      })
      setTimeout(() => {
        const status = text.includes('FAIL') ? 'failed' : 'completed'
        send({
          method: 'turn/completed',
          params: { threadId, turn: { id: turnId, status, error: null } },
        })
        send({
          method: 'thread/status/changed',
          params: { threadId, status: { type: status === 'failed' ? 'systemError' : 'idle' } },
        })
      }, 10)
      return
    }
    case 'turn/interrupt':
      send({ id: message.id, result: {} })
      return
    case 'thread/name/set': {
      const params = message.params ?? {}
      send({ id: message.id, result: {} })
      send({
        method: 'thread/name/updated',
        params: { threadId: params.threadId, threadName: params.name },
      })
      return
    }
    default:
      send({
        id: message.id,
        error: { code: -32601, message: `Fixture does not answer ${message.method}` },
      })
  }
})
