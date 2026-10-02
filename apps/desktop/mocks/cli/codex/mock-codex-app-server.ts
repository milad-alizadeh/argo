import { createInterface } from 'node:readline'
import { readMockReplyDelayMs, SESSION_MOCK_ADVERSARIAL_SEED_ENV } from '@/harnesses/proof-protocol'
import { recordedCodexModels } from '../../recordings/codex-app-server.ts'
import { MOCK_CODEX_PROCESS_TITLE } from '../mock-cli-process-titles.mts'
import { compactionItem, completeTurn } from './fixtures/mock-codex-responses.ts'
import { createMockCodexSkillsAndConfig } from './fixtures/mock-codex-skills-config.ts'
import { handleAskReply } from './mock-ask-question.ts'
import { readMockCodexRequest } from './mock-codex-request.ts'
import { answerStoredHistory, rememberThread } from './mock-codex-stored-threads.ts'
import { createMockTurnStartHandler } from './mock-codex-turn.ts'

process.title = MOCK_CODEX_PROCESS_TITLE
let threadCounter = 0
let turnIndex = 0
const echoFile = process.env.ARGO_CODEX_ECHO_FILE
const COMPLETION_DELAY_MS = 10
const REPLY_DELAY_MS = readMockReplyDelayMs()
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
const answerSkillsAndConfig = createMockCodexSkillsAndConfig(send)
function handleRequest(message: Request) {
  if (answerStoredHistory(message, send) || answerSkillsAndConfig(message)) return
  switch (message.method) {
    case 'initialize':
      send({ id: message.id, result: {} })
      return
    case 'initialized':
      return
    case 'model/list':
      return send({ id: message.id, result: recordedCodexModels })
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
  // The real app-server falls back to its own working directory.
  const cwd = typeof message.params?.cwd === 'string' ? message.params.cwd : process.cwd()
  rememberThread(threadId, cwd)
  send({ id: message.id, result: { thread: { id: threadId } } })
}

function resumeThread(message: Request) {
  const threadId = message.params?.threadId
  send({ id: message.id, result: { thread: { id: threadId } } })
}

function compactThread(message: Request) {
  const threadId = message.params?.threadId
  send({ id: message.id, result: {} })
  compactionItem({ method: 'item/started', send, threadCounter, threadId })
  // The app-server ends a compaction's Turn like any other (codex-rs app-server compaction suite).
  setTimeout(() => {
    compactionItem({ method: 'item/completed', send, threadCounter, threadId })
    const turnId = `mock-compact-turn-${threadCounter}`
    completeTurn({ outcome: 'reply', send, threadId, turnId })
  }, 10)
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
