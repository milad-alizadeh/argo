// The stored history the mock app-server answers with: the real CLI's recorded answers, plus the
// threads this process started. No rollout file or state store is read.
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'
import type { RecordedCall } from '../recorded-calls.ts'
import { recordedCall, recordedCalls } from './recorded-codex-threads.ts'

type Request = { id?: unknown; method?: string; params?: Record<string, unknown> }
type Send = (message: Record<string, unknown>) => void
type StoredThread = ThreadReadResponse['thread']

// A recorded thread, its first Turn and that Turn's prompt: the shapes a started thread copies.
function recordedTemplates() {
  const thread = (recordedCall('thread/read').result as ThreadReadResponse).thread
  const turn = thread.turns[0]
  const prompt = turn?.items.find((item) => item.type === 'userMessage')
  if (turn === undefined || prompt === undefined)
    throw new Error('The recorded Codex thread has no prompted Turn to copy.')
  return { thread, turn, prompt }
}
const templates = recordedTemplates()

const started = new Map<string, StoredThread>()

function recordedAnswer(method: string, threadId: unknown): RecordedCall | undefined {
  return recordedCalls.find(
    (call) =>
      call.method === method && (threadId === undefined || call.params.threadId === threadId),
  )
}

const now = () => Math.floor(Date.now() / 1000)

export function rememberThread(threadId: string, cwd: string) {
  started.set(threadId, {
    ...templates.thread,
    id: threadId,
    sessionId: threadId,
    cwd,
    path: null,
    name: null,
    preview: '',
    createdAt: now(),
    updatedAt: now(),
    recencyAt: now(),
    status: { type: 'idle' },
    turns: [],
  })
}

function recordPrompt(threadId: string, text: string) {
  const thread = started.get(threadId)
  if (thread === undefined) return
  const turnId = `stored-turn-${thread.turns.length + 1}`
  const prompt = {
    ...templates.prompt,
    id: `stored-user-${turnId}`,
    content: [{ type: 'text' as const, text, text_elements: [] }],
  }
  const turn = {
    ...templates.turn,
    id: turnId,
    startedAt: now(),
    completedAt: now(),
    items: [prompt],
  }
  started.set(threadId, {
    ...thread,
    preview: thread.preview === '' ? text : thread.preview,
    updatedAt: now(),
    turns: [...thread.turns, turn],
  })
}

function promptText(input: unknown): string {
  if (!Array.isArray(input)) return ''
  return input
    .map((item) =>
      item !== null && typeof item === 'object' && 'text' in item ? String(item.text) : '',
    )
    .join('')
}

function listThreads() {
  const listed = recordedAnswer('thread/list', undefined)?.result as
    | { data: { updatedAt: number }[] }
    | undefined
  const summaries = [...started.values()].map(({ turns: _turns, ...summary }) => summary)
  const data = [...summaries, ...(listed?.data ?? [])].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  )
  return { ...listed, data }
}

function readThread(threadId: unknown) {
  const thread = typeof threadId === 'string' ? started.get(threadId) : undefined
  if (thread !== undefined) return { thread }
  return recordedAnswer('thread/read', threadId)?.result
}

// A poll asks for `limit` newest Turns; a Feed read asks for all of them.
function listTurns(threadId: unknown, limit: unknown) {
  const thread = typeof threadId === 'string' ? started.get(threadId) : undefined
  const newest = typeof limit === 'number' ? thread?.turns.slice(-limit) : thread?.turns
  if (newest !== undefined) return { data: newest, nextCursor: null }
  return recordedAnswer('thread/turns/list', threadId)?.result
}

function answer(message: Request, send: Send, result: unknown) {
  if (result !== undefined) send({ id: message.id, result })
  else
    send({
      id: message.id,
      error: { code: -32000, message: `thread ${String(message.params?.threadId)} not found` },
    })
}

export function answerStoredHistory(message: Request, send: Send): boolean {
  switch (message.method) {
    case 'thread/list':
      send({ id: message.id, result: listThreads() })
      return true
    case 'thread/read':
      answer(message, send, readThread(message.params?.threadId))
      return true
    case 'thread/turns/list':
      answer(message, send, listTurns(message.params?.threadId, message.params?.limit))
      return true
    case 'thread/loaded/list':
      send({ id: message.id, result: { data: [] } })
      return true
    case 'turn/start': {
      const threadId = message.params?.threadId
      const text = promptText(message.params?.input)
      if (typeof threadId === 'string' && text !== '') recordPrompt(threadId, text)
      return false
    }
    default:
      return false
  }
}
