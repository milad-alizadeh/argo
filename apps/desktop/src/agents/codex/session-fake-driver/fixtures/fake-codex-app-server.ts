// A minimal stand-in for `codex app-server --listen stdio://`, run as a real child process so the
// vertical-slice test in codex-vertical-slice.test.ts exercises the real pipes and NDJSON framing
// this adapter depends on, not just an in-memory fake of `CodexChannel`. It answers exactly the
// verbs `codex-session-driver.ts` sends, grounded in codex-cli 0.147.0's schema
// (docs/research/2026-09-09-codex-transport.md).

import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { askQuestion, handleAskReply } from './fake-ask-question'

let threadCounter = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE

function threadIdFor(counter: number) {
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}

function recordTurn(threadId: string, text: string) {
  const transcripts = process.env.ARGO_CODEX_TRANSCRIPTS
  if (transcripts === undefined) return
  const day = path.join(transcripts, '2026', '09', '14')
  mkdirSync(day, { recursive: true })
  const transcript = path.join(day, `rollout-2026-09-14T15-17-11-${threadId}.jsonl`)
  appendFileSync(
    transcript,
    `${[
      {
        timestamp: new Date().toISOString(),
        type: 'session_meta',
        payload: { id: threadId, cwd: process.cwd() },
      },
      {
        timestamp: new Date().toISOString(),
        type: 'event_msg',
        payload: { type: 'user_message', message: text },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n')}\n`,
  )
}

function send(message: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function request(line: string) {
  return JSON.parse(line) as {
    id?: unknown
    method?: string
    params?: Record<string, unknown>
    result?: unknown
  }
}

function completeTurn(threadId: unknown, turnId: string, text: string) {
  const status = text.includes('FAIL') ? 'failed' : 'completed'
  send({
    method: 'turn/completed',
    params: { threadId, turn: { id: turnId, status, error: null } },
  })
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: status === 'failed' ? 'systemError' : 'idle' } },
  })
}

function handleTurnStart(message: { id?: unknown; params?: Record<string, unknown> }) {
  const params = message.params ?? {}
  const threadId = params.threadId
  const input = Array.isArray(params.input) ? params.input : []
  const text = typeof input[0]?.text === 'string' ? input[0].text : ''
  if (typeof threadId === 'string') recordTurn(threadId, text)
  if (echoFile && !text.includes('ASK')) appendFileSync(echoFile, `${JSON.stringify(text)}\n`)
  const turnId = `fake-turn-${threadCounter}-${Date.now()}`
  send({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: 'active', activeFlags: [] } },
  })
  if (text.includes('ASK')) {
    askQuestion(send, { threadId, turnId, text })
    return
  }
  setTimeout(() => completeTurn(threadId, turnId, text), 10)
}

function handleRequest(message: {
  id?: unknown
  method?: string
  params?: Record<string, unknown>
}) {
  switch (message.method) {
    case 'initialize':
      send({ id: message.id, result: {} })
      return
    case 'initialized':
      return
    case 'thread/start':
      threadCounter += 1
      send({ id: message.id, result: { thread: { id: threadIdFor(threadCounter) } } })
      return
    case 'thread/resume':
      send({ id: message.id, result: { thread: { id: message.params?.threadId } } })
      return
    case 'turn/start':
      handleTurnStart(message)
      return
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
}

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const message = request(line)
  if (message.method === undefined) {
    handleAskReply(message, echoFile, completeTurn)
    return
  }
  handleRequest(message)
})
