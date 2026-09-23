import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { codexStatePath } from '@/harnesses/codex/sessions/discovery/roots'
import { historyFile, type StoredThread, transcriptsRoot } from './mock-codex-history-types.ts'
import { scanRollouts } from './mock-codex-rollout-history.ts'

// Codex Desktop's own app renames a thread by writing straight into its state store
// (`state_5.sqlite`), outside Argo's own rename channel: the real `codex` app-server reads that
// store when it answers `thread/list`/`thread/read`, so this stand-in reads it too, rather than
// only the rollout scan and Argo's own overlay (#2650).
// `state-store` imports `node:sqlite`, which only Electron's Node ships (see its own comment);
// a `bun test` unit run never sets ARGO_CODEX_TRANSCRIPTS, so `require` stays lazy and behind that
// same guard rather than crashing every mock CLI process bun spawns.
const requireFromHere = createRequire(import.meta.url)
function stateStoreNameFor(threadId: string): string | undefined {
  const root = transcriptsRoot()
  if (root === '') return undefined
  const { codexThreadNames } = requireFromHere(
    '../../../src/harnesses/codex/sessions/records/state-store.ts',
  ) as typeof import('@/harnesses/codex/sessions/records/state-store')
  return codexThreadNames(codexStatePath(root))([threadId]).get(threadId)
}

type Request = { id?: unknown; method?: string; params?: Record<string, unknown> }
type Send = (message: Record<string, unknown>) => void

function isThread(value: unknown): value is StoredThread {
  return (
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
  )
}

function readOverlay(): StoredThread[] {
  const file = historyFile()
  if (file === '' || !existsSync(file)) return []
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null || !('threads' in parsed)) return []
    return Array.isArray(parsed.threads) ? parsed.threads.filter(isThread) : []
  } catch {
    return []
  }
}

function writeOverlay(threads: StoredThread[]) {
  const file = historyFile()
  if (file === '') return
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ threads }))
}

export function rememberThread(thread: StoredThread) {
  const threads = readOverlay().filter((candidate) => candidate.id !== thread.id)
  threads.push(thread)
  writeOverlay(threads)
}

export function storedThreads(): StoredThread[] {
  const threads = new Map(scanRollouts().map((thread) => [thread.id, thread]))
  for (const overlay of readOverlay()) {
    const scanned = threads.get(overlay.id)
    threads.set(overlay.id, {
      ...scanned,
      ...overlay,
      turns: overlay.turns.length > 0 ? overlay.turns : (scanned?.turns ?? []),
    })
  }
  for (const [id, thread] of threads) {
    const stateStoreName = stateStoreNameFor(id)
    if (stateStoreName !== undefined) threads.set(id, { ...thread, name: stateStoreName })
  }
  return [...threads.values()]
}

export function recordPrompt(threadId: string, text: string) {
  const existing = storedThreads().find((thread) => thread.id === threadId)
  const turnId = `stored-turn-${Date.now()}`
  rememberThread({
    id: threadId,
    cwd: existing?.cwd ?? null,
    name: existing?.name ?? null,
    updatedAt: Math.floor(Date.now() / 1000),
    status: existing?.status ?? { type: 'idle' },
    turns: [
      ...(existing?.turns ?? []),
      {
        id: turnId,
        status: 'completed',
        startedAt: Math.floor(Date.now() / 1000),
        items: [{ id: `stored-user-${turnId}`, type: 'userMessage', text }],
      },
    ],
  })
}

function previewOf(thread: StoredThread): string | undefined {
  return thread.turns.flatMap((turn) => turn.items).find((item) => item.type === 'userMessage')
    ?.text
}

function promptText(input: unknown): string {
  if (!Array.isArray(input)) return ''
  return input
    .map((item) =>
      item !== null && typeof item === 'object' && 'text' in item ? String(item.text) : '',
    )
    .join('')
}

export function answerStoredHistory(message: Request, send: Send): boolean {
  switch (message.method) {
    case 'thread/list':
      send({
        id: message.id,
        result: {
          data: storedThreads().map((thread) => {
            const preview = previewOf(thread)
            return {
              id: thread.id,
              cwd: thread.cwd,
              name: thread.name,
              ...(thread.name === null && preview !== undefined ? { preview } : {}),
              updatedAt: thread.updatedAt,
              status: thread.status,
            }
          }),
          nextCursor: null,
        },
      })
      return true
    case 'thread/read': {
      const thread = storedThreads().find((candidate) => candidate.id === message.params?.threadId)
      if (thread === undefined) {
        send({ id: message.id, error: { code: -32000, message: 'Codex has no stored Session.' } })
      } else send({ id: message.id, result: { thread } })
      return true
    }
    case 'thread/turns/list':
      send({
        id: message.id,
        error: { code: -32601, message: 'thread/turns/list requires experimentalApi capability' },
      })
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

export function resumeErrorFor(threadId: unknown): string | undefined {
  return storedThreads().find((thread) => thread.id === threadId)?.resumeError
}
