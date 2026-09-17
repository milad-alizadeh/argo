import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { SESSION_MOCK_REPLY_DELAY_MS_ENV } from '../../../src/core/sessions/proof-protocol.ts'
import { askQuestion, handleAskReply } from './mock-ask-question.ts'

let threadCounter = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE
const COMPLETION_DELAY_MS = 10
const replyDelay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
const REPLY_DELAY_MS = Number.isFinite(replyDelay) && replyDelay > 0 ? replyDelay : 0
type MockRequest = { id?: unknown; method?: string; params?: Record<string, unknown> }
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
const PLAN = [
  { step: 'Read the Session protocol', status: 'completed' },
  { step: 'Project the live Plan into the Roster', status: 'inProgress' },
]

function sendPlanUpdate(turnId: string) {
  send({
    method: 'turn/plan/updated',
    params: { turnId, plan: PLAN },
  })
}
function compactionItem(threadId: unknown, method: 'item/started' | 'item/completed') {
  send({
    method,
    params: {
      threadId,
      turnId: `mock-compact-turn-${threadCounter}`,
      item: { id: `mock-compaction-${threadCounter}`, type: 'contextCompaction' },
    },
  })
}

function handleTurnStart(message: MockRequest) {
  const params = message.params ?? {}
  const threadId = params.threadId
  const input = Array.isArray(params.input) ? params.input : []
  const text = typeof input[0]?.text === 'string' ? input[0].text : ''
  if (typeof threadId === 'string') recordTurn(threadId, text)
  if (echoFile && !text.includes('ASK')) appendFileSync(echoFile, `${JSON.stringify(text)}\n`)
  const turnId = `mock-turn-${threadCounter}-${Date.now()}`
  if (text.includes('PLAN_EARLY')) sendPlanUpdate(turnId)
  send({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: 'active', activeFlags: [] } },
  })
  if (text.includes('PLAN') && !text.includes('PLAN_EARLY')) sendPlanUpdate(turnId)
  if (text.includes('ASK')) {
    askQuestion(send, { threadId, turnId, text })
    return
  }
  setTimeout(
    () => completeTurn(threadId, turnId, text),
    REPLY_DELAY_MS === 0 ? COMPLETION_DELAY_MS : REPLY_DELAY_MS,
  )
}

function handleRequest(message: MockRequest) {
  switch (message.method) {
    case 'initialize':
      send({ id: message.id, result: {} })
      return
    case 'initialized':
      return
    case 'thread/start':
      threadCounter += 1
      send({
        id: message.id,
        result: {
          thread: { id: `00000000-0000-4000-8000-${String(threadCounter).padStart(12, '0')}` },
        },
      })
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
    case 'thread/compact/start': {
      const threadId = message.params?.threadId
      send({ id: message.id, result: {} })
      compactionItem(threadId, 'item/started')
      setTimeout(() => compactionItem(threadId, 'item/completed'), 10)
      return
    }
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
  const message = JSON.parse(line) as MockRequest
  if (message.method === undefined) {
    handleAskReply(message, echoFile, completeTurn)
    return
  }
  handleRequest(message)
})
