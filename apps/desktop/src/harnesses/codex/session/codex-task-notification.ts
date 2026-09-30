import type { FeedContent } from '@/domains/sessions/api/feed-content'

function field(value: string, name: string): string | null {
  return value.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null
}

function wholeEnvelope(text: string, name: string): string | null {
  return new RegExp(`^\\s*<${name}(?:\\s[^>]*)?>([\\s\\S]*)</${name}>\\s*$`).exec(text)?.[1] ?? null
}

const TASK_STATUSES = {
  pending: 'pending',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
  stopped: 'interrupted',
  killed: 'interrupted',
} as const satisfies Record<string, NonNullable<Extract<FeedContent, { kind: 'task' }>['status']>>

function optionalId(value: string | null): string | null {
  return value === null || value === '' ? null : value
}

function rejected(id: string, detail: string, reject: () => void): FeedContent {
  reject()
  return { id, kind: 'diagnostic', vendorType: 'task-notification', detail }
}

// A user message that is only a task notification is the delivery, not the person's words.
export function codexTaskNotification(
  id: string,
  text: string,
  reject: () => void,
): FeedContent | null {
  const body = wholeEnvelope(text, 'task-notification')
  if (body === null) return null
  const taskId = optionalId(field(body, 'task-id'))
  if (taskId === null) return rejected(id, 'Missing task ID.', reject)
  const rawStatus = field(body, 'status')
  if (rawStatus === null || !Object.hasOwn(TASK_STATUSES, rawStatus)) {
    return rejected(id, 'Unknown task status.', reject)
  }
  return {
    id,
    kind: 'task',
    taskId,
    callId: optionalId(field(body, 'tool-use-id')),
    status: TASK_STATUSES[rawStatus as keyof typeof TASK_STATUSES],
    description: null,
    summary: field(body, 'summary') ?? field(body, 'result'),
  }
}
