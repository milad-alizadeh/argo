import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { readMockReplyDelayMs } from '@/harnesses/proof-protocol'
import { MOCK_CODEX_MODEL_CATALOG } from './fixtures/mock-codex-model-catalog.ts'

type Item = {
  id: string
  type: string
  text?: string
  content?: Array<{ type: string; text: string }>
}
type Turn = { id: string; status: string; items: Item[] }
type Thread = { id: string; cwd: string; updatedAt: number; turns: Turn[] }
type ActiveTurn = { thread: Thread; turn: Turn; prompt: string }
const statePath = process.env.ARGO_CODEX_E2E_STATE
if (statePath === undefined) throw new Error('Missing ARGO_CODEX_E2E_STATE')
let threads: Thread[] = []
try {
  threads = JSON.parse(readFileSync(statePath, 'utf8')) as Thread[]
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
}
const save = () => writeFileSync(statePath, JSON.stringify(threads))
const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)
const identifier = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const pending = new Map<string, ActiveTurn>()
const REPLY_DELAY_MS = readMockReplyDelayMs()

function finish(active: ActiveTurn, status: 'completed' | 'interrupted' | 'failed') {
  const { thread, turn, prompt } = active
  if (turn.status !== 'inProgress') return
  turn.status = status
  if (status === 'completed') {
    const assistant: Item = {
      id: `${turn.id}-assistant`,
      type: 'agentMessage',
      text: `Codex replied to: ${prompt}`,
    }
    turn.items.push(assistant)
    send({
      method: 'item/agentMessage/delta',
      params: { threadId: thread.id, turnId: turn.id, itemId: assistant.id, delta: assistant.text },
    })
    send({
      method: 'item/completed',
      params: { threadId: thread.id, turnId: turn.id, item: assistant },
    })
  }
  save()
  send({
    method: 'turn/completed',
    params: { threadId: thread.id, turn: { id: turn.id, status, error: null } },
  })
}

type Request = {
  id?: string | number
  method?: string
  params?: Record<string, unknown>
}

function handleResponse(id: string | number) {
  const waiting = pending.get(String(id))
  if (waiting === undefined) return
  pending.delete(String(id))
  finish(waiting, 'completed')
}

function notifyTurn(active: ActiveTurn) {
  const { thread, turn, prompt } = active
  send({
    method: 'turn/started',
    params: { threadId: thread.id, turn: { id: turn.id, status: 'inProgress' } },
  })
  send({
    method: 'item/completed',
    params: { threadId: thread.id, turnId: turn.id, item: turn.items[0] },
  })
  if (prompt === 'Need approval') {
    const requestId = `approval-${turn.id}`
    pending.set(requestId, active)
    send({
      id: requestId,
      method: 'item/commandExecution/requestApproval',
      params: {
        threadId: thread.id,
        turnId: turn.id,
        itemId: `command-${turn.id}`,
        command: 'echo approved',
        approvalId: requestId,
      },
    })
    return
  }
  if (prompt === 'Need question') {
    const requestId = `question-${turn.id}`
    pending.set(requestId, active)
    send({
      id: requestId,
      method: 'item/tool/requestUserInput',
      params: {
        threadId: thread.id,
        turnId: turn.id,
        itemId: requestId,
        questions: [
          {
            id: 'color',
            header: 'Color',
            question: 'Which color?',
            options: [{ label: 'Blue', description: 'Choose blue.' }],
          },
        ],
      },
    })
    return
  }
  if (prompt === 'Wait to interrupt') return
  const outcome = prompt === 'Fail this turn' ? 'failed' : 'completed'
  if (REPLY_DELAY_MS === 0) finish(active, outcome)
  else setTimeout(() => finish(active, outcome), REPLY_DELAY_MS)
}

function startTurn(id: Request['id'], params: Record<string, unknown>, thread: Thread) {
  const turnId = `turn-${thread.turns.length + 1}`
  const input = params.input as Array<{ type: string; text?: string }>
  const prompt = input
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
  const user: Item = {
    id: `${turnId}-user`,
    type: 'userMessage',
    content: [{ type: 'text', text: prompt }],
  }
  const turn: Turn = { id: turnId, status: 'inProgress', items: [user] }
  thread.turns.push(turn)
  thread.updatedAt = Math.floor(Date.now() / 1000)
  save()
  send({ id, result: { turn: { id: turnId } } })
  setTimeout(() => notifyTurn({ thread, turn, prompt }), 50)
}

function handle(message: Request) {
  const { id, method, params = {} } = message
  if (method === undefined && id !== undefined) return handleResponse(id)
  if (method === 'initialized') return
  if (method === 'initialize') return send({ id, result: {} })
  if (method === 'model/list') return send({ id, result: MOCK_CODEX_MODEL_CATALOG })
  if (method === 'thread/list')
    return send({
      id,
      result: {
        data: threads.map(({ id: threadId, cwd, updatedAt }) => ({ id: threadId, cwd, updatedAt })),
        nextCursor: null,
      },
    })
  if (method === 'thread/start') {
    const thread: Thread = {
      id: identifier(threads.length + 1),
      cwd: String(params.cwd),
      updatedAt: Math.floor(Date.now() / 1000),
      turns: [],
    }
    threads.push(thread)
    save()
    return send({ id, result: { thread: { id: thread.id } } })
  }
  const thread = threads.find((candidate) => candidate.id === params.threadId)
  if (thread === undefined)
    return send({ id, error: { code: -32000, message: 'Thread not found' } })
  if (method === 'thread/resume') return send({ id, result: { thread: { id: thread.id } } })
  if (method === 'thread/read') return send({ id, result: { thread } })
  if (method === 'turn/start') return startTurn(id, params, thread)
  if (method === 'turn/interrupt') {
    send({ id, result: {} })
    const turn = thread.turns.find((candidate) => candidate.id === params.turnId)
    if (turn !== undefined) finish({ thread, turn, prompt: 'Wait to interrupt' }, 'interrupted')
    return
  }
  send({ id, error: { code: -32601, message: `Method not found: ${method}` } })
}

createInterface({ input: process.stdin }).on('line', (line) => handle(JSON.parse(line)))
