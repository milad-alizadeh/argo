import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  type StoredItem,
  type StoredThread,
  type StoredTurn,
  transcriptsRoot,
} from './mock-codex-history-types.ts'

type RolloutState = { turns: Map<string, StoredTurn>; cwd: string | null; updatedAt: number | null }

function textFrom(value: unknown): string {
  if (typeof value !== 'object' || value === null) return ''
  if ('text' in value && typeof value.text === 'string') return value.text
  if (!('content' in value) || !Array.isArray(value.content)) return ''
  const text = value.content.find(
    (entry): entry is { text: string } =>
      typeof entry === 'object' &&
      entry !== null &&
      'text' in entry &&
      typeof entry.text === 'string',
  )
  return text?.text ?? ''
}

function itemRole(type: string) {
  if (type === 'UserMessage') return 'userMessage'
  if (type === 'AgentMessage') return 'agentMessage'
  return null
}

function recordLine(line: string, state: RolloutState) {
  if (line === '') return
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return
  }
  if (typeof parsed !== 'object' || parsed === null) return
  const record = parsed as {
    timestamp?: unknown
    type?: unknown
    payload?: Record<string, unknown>
  }
  if (record.type === 'session_meta' && typeof record.payload?.cwd === 'string')
    state.cwd = record.payload.cwd
  if (typeof record.timestamp === 'string') {
    const time = Date.parse(record.timestamp)
    if (Number.isFinite(time))
      state.updatedAt = Math.max(state.updatedAt ?? 0, Math.floor(time / 1000))
  }
  recordItem(record.payload, state)
}

// A rollout names a Subagent activity in snake case; the thread read answers in camel case.
function subagentItem(item: {
  id: string
  kind?: unknown
  agent_thread_id?: unknown
  agent_path?: unknown
}): StoredItem | null {
  const { kind, agent_thread_id: thread, agent_path: agentPath } = item
  if (typeof kind !== 'string' || typeof thread !== 'string' || typeof agentPath !== 'string')
    return null
  return {
    id: item.id,
    type: 'subAgentActivity',
    text: '',
    kind,
    agentThreadId: thread,
    agentPath,
  }
}

function storedItem(id: string, item: Record<string, unknown>, type: unknown): StoredItem | null {
  if (type === 'SubAgentActivity') return subagentItem({ ...item, id })
  const role = typeof type === 'string' ? itemRole(type) : null
  if (role === null) return null
  const phase = typeof item.phase === 'string' ? { phase: item.phase } : {}
  return { id, type: role, text: textFrom(item), ...phase }
}

function recordItem(payload: Record<string, unknown> | undefined, state: RolloutState) {
  const item = payload?.item
  if (payload?.type !== 'item_completed' || typeof item !== 'object' || item === null) return
  const candidate = item as { id?: unknown; type?: unknown }
  if (typeof candidate.id !== 'string') return
  const stored = storedItem(candidate.id, item as Record<string, unknown>, candidate.type)
  if (stored === null) return
  const turnId = typeof payload?.turn_id === 'string' ? payload.turn_id : 'turn'
  const turn = state.turns.get(turnId) ?? {
    id: turnId,
    status: 'completed',
    startedAt: state.updatedAt ?? 0,
    items: [],
  }
  turn.items.push(stored)
  state.turns.set(turnId, turn)
}

function readRollout(file: string): StoredThread {
  const state: RolloutState = { turns: new Map(), cwd: null, updatedAt: null }
  for (const line of readFileSync(file, 'utf8').split('\n')) recordLine(line, state)
  return {
    id: path.basename(file, '.jsonl'),
    cwd: state.cwd,
    name: null,
    updatedAt: state.updatedAt,
    status: { type: 'idle' },
    turns: [...state.turns.values()],
  }
}

function rolloutFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return rolloutFiles(file)
    return entry.name.endsWith('.jsonl') ? [file] : []
  })
}

export function scanRollouts(): StoredThread[] {
  const root = transcriptsRoot()
  if (root === '' || !existsSync(root)) return []
  return rolloutFiles(root).map(readRollout)
}
