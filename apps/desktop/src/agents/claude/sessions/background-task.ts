import { isRecord } from '@/boundary'
import {
  BACKGROUND_STATES,
  type BackgroundState,
  type TranscriptRecord,
} from '@/core/sessions/transcript'

// One field of the notification's own XML body, which is the only place the CLI states it.
export function tagged(body: string, tag: string): string | null {
  return new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(body)?.[1]?.trim() ?? null
}

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
  const taskId = tagged(body, 'task-id')
  const callId = tagged(body, 'tool-use-id')
  const state = tagged(body, 'status')
  if (taskId === null || callId === null || !isBackgroundState(state)) return null
  return {
    kind: 'background-task',
    taskId,
    callId,
    outputPath: tagged(body, 'output-file'),
    state,
    summary: tagged(body, 'summary'),
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
  }
}
