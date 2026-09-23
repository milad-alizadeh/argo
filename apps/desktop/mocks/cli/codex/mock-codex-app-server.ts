import { createInterface } from 'node:readline'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/domains/sessions/contract/proof-protocol'
import { MOCK_CODEX_PROCESS_TITLE } from '../mock-cli-process-titles.mts'
import { MOCK_CODEX_MODEL_CATALOG } from './fixtures/mock-codex-model-catalog.ts'
import { compactionItem, completeTurn } from './fixtures/mock-codex-responses.ts'
import { rememberThreadCwd } from './fixtures/mock-codex-transcript.ts'
import { handleAskReply } from './mock-ask-question.ts'
import { readMockCodexRequest } from './mock-codex-request.ts'
import { answerStoredHistory, rememberThread, resumeErrorFor } from './mock-codex-stored-threads.ts'
import { createMockTurnStartHandler } from './mock-codex-turn.ts'

process.title = MOCK_CODEX_PROCESS_TITLE
let threadCounter = 0
let turnIndex = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE
const COMPLETION_DELAY_MS = 10
const replyDelay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
const REPLY_DELAY_MS = Number.isFinite(replyDelay) && replyDelay > 0 ? replyDelay : 0
const adversarialSeed = process.env[SESSION_MOCK_ADVERSARIAL_SEED_ENV]
const threadIdFor = (counter: number) =>
  `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`
const send = (message: Record<string, unknown>) =>
  process.stdout.write(`${JSON.stringify(message)}\n`)
type Request = { id?: unknown; method?: string; params?: Record<string, unknown> }
const handleTurnStart = createMockTurnStartHandler({
  adversarialSeed,
  echoFile,
  nextThreadCounter: () => threadCounter,
  nextTurnIndex: () => turnIndex++,
  replyDelayMs: REPLY_DELAY_MS === 0 ? COMPLETION_DELAY_MS : REPLY_DELAY_MS,
  send,
})
function handleRequest(message: Request) {
  if (answerStoredHistory(message, send)) return
  switch (message.method) {
    case 'initialize':
      send({ id: message.id, result: {} })
      return
    case 'initialized':
      return
    case 'skills/list':
      return send({ id: message.id, result: { data: [] } })
    case 'model/list':
      return send({ id: message.id, result: MOCK_CODEX_MODEL_CATALOG })
    case 'thread/start':
      return startThread(message)
    case 'thread/resume':
      return resumeThread(message)
    case 'thread/unsubscribe':
      send({ id: message.id, result: { status: 'unsubscribed' } })
      return
    case 'turn/start':
      handleTurnStart(message)
      return
    case 'turn/interrupt':
      send({ id: message.id, result: {} })
      return
    case 'thread/compact/start':
      return compactThread(message)
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

function startThread(message: Request) {
  threadCounter += 1
  const threadId = threadIdFor(threadCounter)
  const cwd = typeof message.params?.cwd === 'string' ? message.params.cwd : null
  if (cwd !== null) rememberThreadCwd(threadId, cwd)
  rememberThread({
    id: threadId,
    cwd,
    name: null,
    updatedAt: Math.floor(Date.now() / 1000),
    status: { type: 'idle' },
    turns: [],
  })
  send({ id: message.id, result: { thread: { id: threadId } } })
}

function resumeThread(message: Request) {
  const threadId = message.params?.threadId
  const error = resumeErrorFor(threadId)
  if (error !== undefined) return send({ id: message.id, error: { code: -32000, message: error } })
  const cwd = message.params?.cwd
  if (typeof threadId === 'string' && typeof cwd === 'string') rememberThreadCwd(threadId, cwd)
  send({ id: message.id, result: { thread: { id: threadId } } })
}

function compactThread(message: Request) {
  const threadId = message.params?.threadId
  send({ id: message.id, result: {} })
  compactionItem({ method: 'item/started', send, threadCounter, threadId })
  setTimeout(() => compactionItem({ method: 'item/completed', send, threadCounter, threadId }), 10)
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
