import type { BackgroundState, BackgroundTaskRecord } from '@/domains/sessions/contract/transcript'
import { taggedField } from '@/harnesses/envelope-tags'
import { isRecord } from '@/shared/validation'

// The CLI's notification words, folded into the states the contract holds.
const NOTIFICATION_STATES = {
  completed: 'completed',
  failed: 'failed',
  killed: 'interrupted',
  stopped: 'interrupted',
} as const satisfies Record<string, BackgroundState>

export function backgroundState(value: string | null): BackgroundState | null {
  return value !== null && Object.hasOwn(NOTIFICATION_STATES, value)
    ? NOTIFICATION_STATES[value as keyof typeof NOTIFICATION_STATES]
    : null
}

// The ending a `<task-notification>` body names, or null when it names no task, call or state.
export function readTaskEnding(body: string, timestamp: unknown): BackgroundTaskRecord | null {
  const taskId = taggedField(body, 'task-id')
  const callId = taggedField(body, 'tool-use-id')
  const state = backgroundState(taggedField(body, 'status'))
  if (taskId === null || callId === null || state === null) return null
  return {
    kind: 'background-task',
    taskId,
    callId,
    outputPath: taggedField(body, 'output-file'),
    state,
    summary: taggedField(body, 'summary'),
    timestamp: typeof timestamp === 'string' ? timestamp : null,
  }
}

// The CLI's `task-notification`: one background task ended. Mid-Turn the CLI writes it three
// times, as two queue operations and this attachment, and only the attachment carries a timestamp.
export function readBackgroundTask(record: Record<string, unknown>): BackgroundTaskRecord | null {
  const attachment = isRecord(record.attachment) ? record.attachment : null
  if (attachment?.commandMode !== 'task-notification') return null
  if (typeof attachment.prompt !== 'string') return null
  return readTaskEnding(attachment.prompt, record.timestamp)
}
