// A minimal stand-in for `codex app-server --listen stdio://`, run as a real child process so the
// vertical-slice test in codex-vertical-slice.test.ts exercises the real pipes and NDJSON framing
// this adapter depends on, not just an in-memory fake of `CodexChannel`. It answers exactly the
// verbs `codex-session-driver.ts` sends, grounded in codex-cli 0.147.0's schema
// (docs/research/2026-09-09-codex-transport.md).

import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  SESSION_FAKE_ADVERSARIAL_SEED_ENV,
  SESSION_FAKE_REPLY_DELAY_MS_ENV,
} from '../../../../core/sessions/proof-protocol.ts'
import { askQuestion, handleAskReply } from './fake-ask-question.ts'
import { nextAdversarialTurn, writeSplitReply } from './fake-codex-adversarial.ts'
import { compactionItem, completeTurn } from './fake-codex-responses.ts'
import { recordTurn } from './fake-codex-transcript.ts'

let threadCounter = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE
const COMPLETION_DELAY_MS = 10
const replyDelay = Number(process.env[SESSION_FAKE_REPLY_DELAY_MS_ENV] ?? '0')
const REPLY_DELAY_MS = Number.isFinite(replyDelay) && replyDelay > 0 ? replyDelay : 0
const adversarialSeed = process.env[SESSION_FAKE_ADVERSARIAL_SEED_ENV]
let turnIndex = 0

function threadIdFor(counter: number) {
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
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

function handleTurnStart(message: { id?: unknown; params?: Record<string, unknown> }) {
  const params = message.params ?? {}
  const threadId = params.threadId
  const input = Array.isArray(params.input) ? params.input : []
  const text = typeof input[0]?.text === 'string' ? input[0].text : ''
  const plan = nextAdversarialTurn(adversarialSeed, turnIndex++)
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
  if (plan !== null) {
    writeSplitReply(
      {
        method: 'item/agentMessage/delta',
        params: {
          threadId,
          turnId,
          itemId: `fake-message-${turnId}`,
          delta: `Fake Codex read: ${text} 🦜`,
        },
      },
      plan.replySplitByte,
      (chunk) => process.stdout.write(chunk),
    )
    if (plan.outcome === 'stall') return
  }
  setTimeout(
    () =>
      completeTurn({
        threadId,
        turnId,
        outcome:
          plan?.outcome === 'failure' || (plan === null && text.includes('FAIL'))
            ? 'failure'
            : 'reply',
        send,
      }),
    plan?.firstReplyDelayMs ?? (REPLY_DELAY_MS === 0 ? COMPLETION_DELAY_MS : REPLY_DELAY_MS),
  )
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
    case 'thread/compact/start': {
      const threadId = message.params?.threadId
      send({ id: message.id, result: {} })
      compactionItem({ method: 'item/started', send, threadCounter, threadId })
      setTimeout(
        () => compactionItem({ method: 'item/completed', send, threadCounter, threadId }),
        10,
      )
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
  const message = request(line)
  if (message.method === undefined) {
    handleAskReply(message, echoFile, (threadId, turnId) =>
      completeTurn({ outcome: 'reply', send, threadId, turnId }),
    )
    return
  }
  handleRequest(message)
})
