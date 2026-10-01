import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { readMockReplyDelayMs, SESSION_MOCK_ADVERSARIAL_SEED_ENV } from '@/harnesses/proof-protocol'
import { MOCK_START_REFUSED_FOLDER } from '../mock-cli.ts'
import { nextAdversarialTurn, writeSplitReply } from './fixtures/mock-codex-adversarial.ts'
import { MOCK_CODEX_MODEL_CATALOG } from './fixtures/mock-codex-model-catalog.ts'
import { createMockCodexSkillsAndConfig } from './fixtures/mock-codex-skills-config.ts'

type Item = {
  id: string
  type: string
  text?: string
  content?: Array<{ type: string; text: string }>
}
type Turn = { id: string; status: string; items: Item[]; completedAt?: number }
// `path` is the thread's rollout, as `thread/read` names it.
type Thread = {
  id: string
  cwd: string
  updatedAt: number
  name?: string
  path?: string
  turns: Turn[]
}
type ActiveTurn = { thread: Thread; turn: Turn; prompt: string }
const statePath = process.env.ARGO_CODEX_E2E_STATE
if (statePath === undefined) throw new Error('Missing ARGO_CODEX_E2E_STATE')
let threads: Thread[] = []
try {
  threads = JSON.parse(readFileSync(statePath, 'utf8')) as Thread[]
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
}
// Another process's thread is stored on disk, so its newest Turn is read from there each time.
function newestStoredTurn(threadId: string) {
  const stored = JSON.parse(readFileSync(statePath as string, 'utf8')) as Thread[]
  const turn = stored.find((candidate) => candidate.id === threadId)?.turns.at(-1)
  if (turn === undefined) return []
  const completedAt =
    turn.status === 'inProgress' ? null : (turn.completedAt ?? Math.floor(Date.now() / 1000))
  return [{ ...turn, completedAt }]
}
const save = () => writeFileSync(statePath, JSON.stringify(threads))
const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)
const identifier = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const pending = new Map<string, ActiveTurn>()
const REPLY_DELAY_MS = readMockReplyDelayMs()
const adversarialSeed = process.env[SESSION_MOCK_ADVERSARIAL_SEED_ENV]
let turnIndex = 0

// Another Codex client renames a thread in the shared store, so a list re-reads names from it.
function storedNames(): Map<string, string> {
  try {
    const stored = JSON.parse(readFileSync(statePath, 'utf8')) as Thread[]
    return new Map(stored.flatMap((thread) => (thread.name ? [[thread.id, thread.name]] : [])))
  } catch {
    return new Map()
  }
}

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

// A seeded Turn: the reply's four-byte character split across two stdout writes, then its outcome.
function finishAdversarially(
  active: ActiveTurn,
  plan: NonNullable<ReturnType<typeof nextAdversarialTurn>>,
) {
  const { thread, turn, prompt } = active
  const assistant: Item = {
    id: `${turn.id}-assistant`,
    type: 'agentMessage',
    text: `Mock Codex read: ${prompt} 🦜`,
  }
  turn.items.push(assistant)
  writeSplitReply(
    {
      method: 'item/agentMessage/delta',
      params: { threadId: thread.id, turnId: turn.id, itemId: assistant.id, delta: assistant.text },
    },
    plan.replySplitByte,
    (chunk) => process.stdout.write(chunk),
  )
  send({
    method: 'item/completed',
    params: { threadId: thread.id, turnId: turn.id, item: assistant },
  })
  turn.status = plan.outcome === 'failure' ? 'failed' : 'completed'
  save()
  send({
    method: 'turn/completed',
    params: { threadId: thread.id, turn: { id: turn.id, status: turn.status, error: null } },
  })
  send({
    method: 'thread/status/changed',
    params: {
      threadId: thread.id,
      status: { type: turn.status === 'failed' ? 'systemError' : 'idle' },
    },
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

function notifyFeedActivity(active: ActiveTurn) {
  const { thread, turn } = active
  setTimeout(
    () =>
      send({
        method: 'item/started',
        params: {
          threadId: thread.id,
          turnId: turn.id,
          item: {
            id: `${turn.id}-command`,
            type: 'commandExecution',
            command: 'rtk bun run typecheck',
            status: 'inProgress',
          },
        },
      }),
    1_200,
  )
  setTimeout(
    () =>
      send({
        method: 'item/reasoning/summaryTextDelta',
        params: {
          threadId: thread.id,
          turnId: turn.id,
          itemId: `${turn.id}-reason`,
          summaryIndex: 0,
          delta: 'Inspecting the results',
        },
      }),
    2_400,
  )
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
  if (prompt.includes('FeedActivityProbe')) notifyFeedActivity(active)
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
  const plan = nextAdversarialTurn(adversarialSeed, turnIndex++)
  if (plan !== null) {
    if (plan.outcome !== 'stall')
      setTimeout(() => finishAdversarially(active, plan), plan.firstReplyDelayMs)
    return
  }
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

const answerSkillsAndConfig = createMockCodexSkillsAndConfig(send)

function handle(message: Request) {
  const { id, method, params = {} } = message
  if (method === undefined && id !== undefined) return handleResponse(id)
  if (answerSkillsAndConfig(message)) return
  if (method === 'initialized') return
  if (method === 'initialize') return send({ id, result: {} })
  if (method === 'model/list') return send({ id, result: MOCK_CODEX_MODEL_CATALOG })
  if (method === 'thread/list') {
    const names = storedNames()
    return send({
      id,
      result: {
        data: threads.map(({ id: threadId, cwd, updatedAt, name }) => ({
          id: threadId,
          cwd,
          updatedAt,
          name: names.get(threadId) ?? name,
        })),
        nextCursor: null,
      },
    })
  }
  if (method === 'thread/start' && path.basename(String(params.cwd)) === MOCK_START_REFUSED_FOLDER)
    return send({ id, error: { code: -32000, message: 'Mock Codex cannot start here.' } })
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
  handleThread(message, thread)
}

// A request about one stored thread.
function handleThread({ id, method, params = {} }: Request, thread: Thread) {
  if (method === 'thread/resume') return send({ id, result: { thread: { id: thread.id } } })
  if (method === 'thread/read') return send({ id, result: { thread } })
  if (method === 'thread/turns/list')
    return send({ id, result: { data: newestStoredTurn(thread.id), nextCursor: null } })
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
