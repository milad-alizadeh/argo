import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '../../../src/domains/sessions/main/proof-protocol.ts'
import { MOCK_CODEX_PROCESS_TITLE } from '../mock-cli-process-titles.mts'
import { nextAdversarialTurn, writeSplitReply } from './fixtures/mock-codex-adversarial.ts'
import { sendPlanUpdate } from './fixtures/mock-codex-plan.ts'
import { compactionItem, completeTurn } from './fixtures/mock-codex-responses.ts'
import { recordStalledTurn, recordTurn } from './fixtures/mock-codex-transcript.ts'
import { askQuestion, handleAskReply } from './mock-ask-question.ts'
import { readMockCodexRequest } from './mock-codex-request.ts'

process.title = MOCK_CODEX_PROCESS_TITLE
let threadCounter = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE
const COMPLETION_DELAY_MS = 10
const replyDelay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
const REPLY_DELAY_MS = Number.isFinite(replyDelay) && replyDelay > 0 ? replyDelay : 0
const adversarialSeed = process.env[SESSION_MOCK_ADVERSARIAL_SEED_ENV]
let turnIndex = 0

function threadIdFor(counter: number) {
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
}
const send = (message: Record<string, unknown>) =>
  process.stdout.write(`${JSON.stringify(message)}\n`)
function handleTurnStart(message: { id?: unknown; params?: Record<string, unknown> }) {
  const params = message.params ?? {}
  const threadId = params.threadId
  const input = Array.isArray(params.input) ? params.input : []
  const text = typeof input[0]?.text === 'string' ? input[0].text : ''
  const plan = nextAdversarialTurn(adversarialSeed, turnIndex++)
  if (typeof threadId === 'string') {
    if (plan?.outcome === 'stall') recordStalledTurn(threadId)
    else recordTurn(threadId, text)
  }
  if (echoFile && !text.includes('ASK')) appendFileSync(echoFile, `${JSON.stringify(text)}\n`)
  const turnId = `mock-turn-${threadCounter}-${Date.now()}`
  sendPlanUpdate({ text, turnId, send, beforeTurnStart: true })
  send({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: 'active', activeFlags: [] } },
  })
  sendPlanUpdate({ text, turnId, send, beforeTurnStart: false })
  if (text.includes('ASK')) {
    askQuestion(send, { threadId, turnId, text })
    return
  }
  if (plan?.permissionBeforeReply) {
    askQuestion(send, { threadId, turnId, text })
    return
  }
  if (plan !== null) {
    setTimeout(() => {
      if (plan.outcome === 'stall') return
      writeSplitReply(
        {
          method: 'item/agentMessage/delta',
          params: {
            threadId,
            turnId,
            itemId: `mock-message-${turnId}`,
            delta: `Mock Codex read: ${text} 🦜`,
          },
        },
        plan.replySplitByte,
        (chunk) => process.stdout.write(chunk),
      )
      completeTurn({
        outcome: plan.outcome === 'failure' ? 'failure' : 'reply',
        send,
        threadId,
        turnId,
      })
    }, plan.firstReplyDelayMs)
    return
  }
  setTimeout(
    () =>
      completeTurn({
        threadId,
        turnId,
        outcome: text.includes('FAIL') ? 'failure' : 'reply',
        send,
      }),
    REPLY_DELAY_MS === 0 ? COMPLETION_DELAY_MS : REPLY_DELAY_MS,
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
  const message = readMockCodexRequest(line)
  if (message.method === undefined) {
    handleAskReply(message, echoFile, (threadId, turnId) =>
      completeTurn({ outcome: 'reply', send, threadId, turnId }),
    )
    return
  }
  handleRequest(message)
})
