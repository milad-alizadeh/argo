import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SubAgentActivityKind } from '../app-server'
import { codexSubagentContent } from './codex-subagent-content'
import { codexTaskNotification } from './codex-task-notification'

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

function messageEvents(payload: unknown, reject: () => void): SessionLiveEventBody[] {
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
  const task = item.type === 'UserMessage' ? codexTaskNotification(item.id, text, reject) : null
  return [
    {
      type: 'content',
      commandId: null,
      turnId,
      vendorEventId: item.id,
      content: task ?? {
        id: item.id,
        kind: 'message',
        role: item.type === 'UserMessage' ? 'user' : 'assistant',
        text,
        ...(item.type === 'AgentMessage' ? { phase: undefined } : {}),
      },
    },
  ]
}

// A rollout names a Subagent activity in snake case. It draws the same content `thread/read`
// draws, so a live count and a reload from history agree.
const SUBAGENT_KINDS: Record<SubAgentActivityKind, true> = {
  started: true,
  interacted: true,
  interrupted: true,
  completed: true,
}

function subagentEvents(payload: unknown, reject: () => void): SessionLiveEventBody[] {
  const record = object(payload)
  if (record?.type !== 'item_completed') return []
  const item = object(record.item)
  if (item?.type !== 'SubAgentActivity') return []
  const { id, kind, agent_thread_id: agentThreadId, agent_path: agentPath } = item
  if (
    typeof id !== 'string' ||
    typeof agentThreadId !== 'string' ||
    typeof agentPath !== 'string'
  ) {
    reject()
    return []
  }
  if (typeof kind !== 'string' || !Object.hasOwn(SUBAGENT_KINDS, kind)) {
    reject()
    return []
  }
  return [
    {
      type: 'content',
      commandId: null,
      turnId: typeof record.turn_id === 'string' ? record.turn_id : null,
      vendorEventId: id,
      content: codexSubagentContent(
        {
          type: 'subAgentActivity',
          id,
          kind: kind as SubAgentActivityKind,
          agentThreadId,
          agentPath,
        },
        undefined,
      ),
    },
  ]
}

// What the lines a rollout appended draw, or that the Feed must read the thread whole.
type HistoryChange = { type: 'appended'; events: SessionLiveEventBody[] } | { type: 'rewritten' }

// A command or an edit differs between a rollout and `thread/read`, so the Feed reads it whole.
const READ_WHOLE = new Set(['CommandExecution', 'FileChange'])

function completesWork(line: string): boolean {
  const record = recordOf(line)
  const type = record?.type === 'event_msg' ? completedItem(record.payload)?.item.type : undefined
  return typeof type === 'string' && READ_WHOLE.has(type)
}

// Streams the messages a rollout completes and reads the whole Session for completed work.
export function openCodexHistoryReader(): (lines: readonly string[]) => HistoryChange {
  return (lines) => {
    let rejected = 0
    const reject = () => {
      rejected += 1
    }
    const events = lines.flatMap((line) => {
      const record = recordOf(line)
      if (record === null || typeof record.type !== 'string') {
        reject()
        return []
      }
      if (record.type !== 'event_msg') return []
      return [...messageEvents(record.payload, reject), ...subagentEvents(record.payload, reject)]
    })
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Codex rollout line(s).`)
    return lines.some(completesWork) ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
