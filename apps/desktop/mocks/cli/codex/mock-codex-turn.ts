import { appendFileSync } from 'node:fs'
import { nextAdversarialTurn, writeSplitReply } from './fixtures/mock-codex-adversarial.ts'
import { sendPlanUpdate } from './fixtures/mock-codex-plan.ts'
import { completeTurn } from './fixtures/mock-codex-responses.ts'
import { recordStalledTurn, recordTurn } from './fixtures/mock-codex-transcript.ts'
import { askQuestion } from './mock-ask-question.ts'

type Request = { id?: unknown; params?: Record<string, unknown> }
type Send = (message: Record<string, unknown>) => void

function sendToolUsage(send: Send, threadId: unknown, turnId: string) {
  send({
    method: 'item/started',
    params: {
      threadId,
      turnId,
      startedAtMs: Date.now(),
      item: {
        id: `mock-command-${turnId}`,
        type: 'commandExecution',
        command: 'rtk bun run typecheck',
        commandActions: [],
        cwd: process.cwd(),
        status: 'inProgress',
      },
    },
  })
  send({
    method: 'thread/tokenUsage/updated',
    params: {
      threadId,
      turnId,
      tokenUsage: {
        last: tokenUsage(),
        total: tokenUsage(),
      },
    },
  })
}

function tokenUsage() {
  return {
    cachedInputTokens: 0,
    inputTokens: 23,
    outputTokens: 5,
    reasoningOutputTokens: 0,
    totalTokens: 28,
  }
}

function finishTurn(options: {
  plan: ReturnType<typeof nextAdversarialTurn>
  send: Send
  text: string
  threadId: unknown
  turnId: string
  replyDelayMs: number
}) {
  const { plan, send, text, threadId, turnId, replyDelayMs } = options
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
    replyDelayMs,
  )
}

function asksQuestion(text: string, plan: ReturnType<typeof nextAdversarialTurn>): boolean {
  return text.includes('ASK') || plan?.permissionBeforeReply === true
}

export function createMockTurnStartHandler(options: {
  adversarialSeed: string | undefined
  echoFile: string | undefined
  nextThreadCounter: () => number
  nextTurnIndex: () => number
  replyDelayMs: number
  send: Send
}) {
  return (message: Request) => {
    const params = message.params ?? {}
    const threadId = params.threadId
    const input = Array.isArray(params.input) ? params.input : []
    const text = typeof input[0]?.text === 'string' ? input[0].text : ''
    const plan = nextAdversarialTurn(options.adversarialSeed, options.nextTurnIndex())
    if (typeof threadId === 'string') {
      if (plan?.outcome === 'stall') recordStalledTurn(threadId)
      else recordTurn(threadId, text)
    }
    if (options.echoFile && !text.includes('ASK'))
      appendFileSync(options.echoFile, `${JSON.stringify(text)}\n`)
    const turnId = `mock-turn-${options.nextThreadCounter()}-${Date.now()}`
    sendPlanUpdate({ text, turnId, send: options.send, beforeTurnStart: true })
    options.send({ id: message.id, result: { turn: { id: turnId, status: 'inProgress' } } })
    options.send({
      method: 'thread/status/changed',
      params: { threadId, status: { type: 'active', activeFlags: [] } },
    })
    sendPlanUpdate({ text, turnId, send: options.send, beforeTurnStart: false })
    if (text.includes('PROJECT_TOOL_USAGE'))
      setTimeout(() => sendToolUsage(options.send, threadId, turnId), 1)
    if (asksQuestion(text, plan)) {
      askQuestion(options.send, { threadId, turnId, text })
      return
    }
    finishTurn({
      plan,
      send: options.send,
      text,
      threadId,
      turnId,
      replyDelayMs: options.replyDelayMs,
    })
  }
}
