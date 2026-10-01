// The stored history the mock app-server answers with: the real CLI's recorded answers, plus the
// threads this process started. No rollout file or state store is read.
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'
import { type RecordedCall, recordedCalls } from './recorded-codex-threads.ts'

type Request = { id?: unknown; method?: string; params?: Record<string, unknown> }
type Send = (message: Record<string, unknown>) => void
type StoredThread = ThreadReadResponse['thread']
type StoredTurn = StoredThread['turns'][number]

const recorded = recordedCalls()
const started = new Map<string, StoredThread>()

function recordedAnswer(method: string, threadId: unknown): RecordedCall | undefined {
  return recorded.find(
    (call) =>
      call.method === method && (threadId === undefined || call.params.threadId === threadId),
  )
}

const now = () => Math.floor(Date.now() / 1000)

// Only the fields Argo reads; the recorded threads carry the rest.
export function rememberThread(threadId: string, cwd: string | null) {
  started.set(threadId, {
    id: threadId,
    cwd,
    name: null,
    preview: '',
    createdAt: now(),
    updatedAt: now(),
    status: { type: 'idle' },
    turns: [],
  } as unknown as StoredThread)
}

function recordPrompt(threadId: string, text: string) {
  const thread = started.get(threadId)
  if (thread === undefined) return
  const turnId = `stored-turn-${thread.turns.length + 1}`
  const turn = {
    id: turnId,
    status: 'completed',
    items: [
      { id: `stored-user-${turnId}`, type: 'userMessage', content: [{ type: 'text', text }] },
    ],
  } as unknown as StoredTurn
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

function listTurns(threadId: unknown) {
  const thread = typeof threadId === 'string' ? started.get(threadId) : undefined
  if (thread !== undefined) return { data: thread.turns, nextCursor: null }
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
      answer(message, send, listTurns(message.params?.threadId))
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
