import { isRecord } from '@/boundary'
import {
  BACKGROUND_STATES,
  type BackgroundState,
  type BackgroundTaskRecord,
} from '@/domains/sessions/contract/transcript'
import { taggedField } from '../../envelope-tags'

function isBackgroundState(value: string | null): value is BackgroundState {
  return value !== null && (BACKGROUND_STATES as readonly string[]).includes(value)
}

// The ending a `<task-notification>` body names, or null when it names no task, call or state.
export function readTaskEnding(body: string, timestamp: unknown): BackgroundTaskRecord | null {
  const taskId = taggedField(body, 'task-id')
  const callId = taggedField(body, 'tool-use-id')
  const state = taggedField(body, 'status')
  if (taskId === null || callId === null || !isBackgroundState(state)) return null
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
