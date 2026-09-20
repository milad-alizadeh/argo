import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript'
import { messageRecord } from '@/harnesses/codex/sessions/message-record'
import { isRecord } from '@/shared/validation'

// Codex writes each summary as a Markdown headline (`**Reading the plan**`); the Feed draws a
// thought as plain text, so the markers come off here.
function thoughtText(summary: string): string {
  return summary.replaceAll('**', '')
}

export function reasoningSummary(
  record: Record<string, unknown>,
  payload: Record<string, unknown>,
): TranscriptRecord | null {
  if (payload.type !== 'reasoning' || typeof payload.id !== 'string') return null
  if (!Array.isArray(payload.summary)) return null
  const blocks = payload.summary.flatMap((summary) => {
    if (!isRecord(summary) || summary.type !== 'summary_text' || typeof summary.text !== 'string')
      return []
    return [{ shape: 'thought' as const, text: thoughtText(summary.text) }]
  })
  if (blocks.length === 0) return null
  return messageRecord(record, {
    uuid: payload.id,
    role: 'assistant',
    originSessionId: null,
    blocks,
  })
}
