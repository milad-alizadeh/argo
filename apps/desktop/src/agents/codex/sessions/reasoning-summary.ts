import type { TranscriptRecord } from '@/core/sessions/transcript'
import { isRecord } from '@/shared/validation'
import { messageRecord } from './message-record'

export function reasoningSummary(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'reasoning' || typeof payload.id !== 'string') return null
  if (!Array.isArray(payload.summary)) return null
  const blocks = payload.summary.flatMap((summary) => {
    if (!isRecord(summary) || summary.type !== 'summary_text' || typeof summary.text !== 'string')
      return []
    return [{ shape: 'thought' as const, text: summary.text }]
  })
  if (blocks.length === 0) return null
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks,
  })
}
