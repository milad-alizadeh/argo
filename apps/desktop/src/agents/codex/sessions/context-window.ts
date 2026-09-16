import type { TranscriptRecord } from '@/core/sessions/transcript'

export function taskStartedContextWindow(
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (
    payload.type !== 'task_started' ||
    typeof payload.turn_id !== 'string' ||
    typeof payload.model_context_window !== 'number' ||
    !Number.isSafeInteger(payload.model_context_window) ||
    payload.model_context_window <= 0
  ) {
    return null
  }
  return {
    kind: 'trace',
    uuid: `task-started:${payload.turn_id}`,
    contextWindowTokens: payload.model_context_window,
  }
}
