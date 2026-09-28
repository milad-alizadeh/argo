import path from 'node:path'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryTurn } from '@/harnesses/registration'

const turnOfEvent: Record<string, HistoryTurn> = {
  task_started: 'open',
  task_complete: 'closed',
  turn_aborted: 'closed',
}

// `YYYY/MM/DD/rollout-<timestamp>-<threadId>.jsonl`, where the thread id may stand alone.
export function codexHistoryOwner(relativePath: string): string | null {
  if (path.extname(relativePath) !== '.jsonl') return null
  const name = path.basename(relativePath, '.jsonl')
  if (!name.startsWith('rollout-')) return null
  return /^rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)$/.exec(name)?.[1] ?? name
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function recordOf(line: string): Record<string, unknown> | null {
  try {
    return object(JSON.parse(line))
  } catch {
    return null
  }
}

export function codexHistoryTurn(line: string): HistoryTurn | null {
  const event = recordOf(line)
  if (event?.type !== 'event_msg') return null
  const payload = object(event.payload)
  return typeof payload?.type === 'string' ? (turnOfEvent[payload.type] ?? null) : null
}

function completedItem(payload: unknown) {
  const record = object(payload)
  if (record?.type !== 'item_completed') return null
  const item = object(record.item)
  if (item === null) return null
  const id = item.id
  if (typeof id !== 'string' || id === '') return null
  return {
    item: { id, type: item.type, content: item.content },
    turnId: typeof record.turn_id === 'string' ? record.turn_id : null,
  }
}

function messageEvents(payload: unknown): SessionLiveEventBody[] {
  const completed = completedItem(payload)
  if (completed === null) return []
  const { item, turnId } = completed
  if (item.type !== 'UserMessage' && item.type !== 'AgentMessage') return []
  const blocks = Array.isArray(item.content) ? item.content : []
  const texts = blocks.flatMap((block) => {
    const text = object(block)
    return typeof text?.type === 'string' && typeof text.text === 'string' ? [text.text] : []
  })
  const text = texts.join(item.type === 'UserMessage' ? '\n' : '')
  if (text === '') return []
  return [
    {
      type: 'content',
      commandId: null,
      turnId,
      vendorEventId: item.id,
      content: {
        id: item.id,
        kind: 'message',
        role: item.type === 'UserMessage' ? 'user' : 'assistant',
        text,
        ...(item.type === 'AgentMessage' ? { phase: undefined } : {}),
      },
    },
  ]
}

// A command's rollout fields differ from its `thread/read` shape, so the Feed reads it whole.
function completesCommand(line: string): boolean {
  const record = recordOf(line)
  return (
    record?.type === 'event_msg' && completedItem(record.payload)?.item.type === 'CommandExecution'
  )
}

// Streams the messages a rollout completes and reads the whole Session for a completed command.
export function openCodexHistoryReader(): (lines: readonly string[]) => HistoryChange {
  return (lines) => {
    let rejected = 0
    const events = lines.flatMap((line) => {
      const record = recordOf(line)
      if (record === null || typeof record.type !== 'string') {
        rejected += 1
        return []
      }
      return record.type === 'event_msg' ? messageEvents(record.payload) : []
    })
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex rollout line(s).`)
    return lines.some(completesCommand) ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
