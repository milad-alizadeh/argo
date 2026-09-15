import { isRecord } from '@/boundary'
import {
  BACKGROUND_STATES,
  type BackgroundState,
  type TranscriptRecord,
} from '@/core/sessions/transcript'
import { taggedField } from '../../envelope-tags'

function isBackgroundState(value: string | null): value is BackgroundState {
  return value !== null && (BACKGROUND_STATES as readonly string[]).includes(value)
}

// The CLI's `task-notification`: one background task ended. The CLI writes it three times, as two
// queue operations and this attachment, and only the attachment carries a timestamp of its own.
export function readBackgroundTask(record: Record<string, unknown>): TranscriptRecord | null {
  const attachment = isRecord(record.attachment) ? record.attachment : null
  if (attachment?.commandMode !== 'task-notification') return null
  if (typeof attachment.prompt !== 'string') return null
  const body = attachment.prompt
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
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
  }
}
