import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { isRecord } from '@/shared/validation'

export function readTurnRecord(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (
    (payload.type !== 'task_complete' && payload.type !== 'turn_aborted') ||
    typeof payload.turn_id !== 'string'
  )
    return null
  return {
    kind: 'turn',
    uuid: `turn:${payload.turn_id}`,
    state: payload.type === 'task_complete' ? 'completed' : 'aborted',
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
  }
}

function setup(payload: Record<string, unknown>): TranscriptRecord | null {
  if (
    typeof payload.turn_id !== 'string' ||
    payload.root_turn_id !== payload.turn_id ||
    typeof payload.model !== 'string' ||
    typeof payload.effort !== 'string'
  )
    return null
  const collaboration = isRecord(payload.collaboration_mode) ? payload.collaboration_mode : null
  return {
    kind: 'setup',
    startsTurn: true,
    model: payload.model,
    effort: payload.effort,
    mode:
      collaboration !== null && typeof collaboration.mode === 'string' ? collaboration.mode : null,
  }
}

function usage(payload: Record<string, unknown>): TranscriptRecord | null {
  const turn = isRecord(payload.turn_token_usage) ? payload.turn_token_usage : null
  const thread = isRecord(payload.thread_token_usage) ? payload.thread_token_usage : null
  if (
    turn === null ||
    thread === null ||
    !Number.isInteger(turn.total_tokens) ||
    !Number.isInteger(thread.total_tokens)
  )
    return null
  return {
    kind: 'usage',
    contextTokens: turn.total_tokens as number,
    spentTokens: thread.total_tokens as number,
  }
}

export function readSessionFact(
  type: unknown,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (type === 'turn_context') return setup(payload)
  return type === 'token_usage_record' ? usage(payload) : null
}
