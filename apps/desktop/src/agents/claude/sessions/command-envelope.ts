import { isRecord } from '@/boundary'
import type { TranscriptMessage, TranscriptRecord } from '@/core/sessions/transcript'

function tagged(tag: string, text: string): string | null {
  return text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? null
}

function envelopeText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const first = content[0]
  return isRecord(first) && first.type === 'text' && typeof first.text === 'string'
    ? first.text
    : null
}

export function readCommandEnvelope(
  record: Record<string, unknown>,
  message: TranscriptMessage,
): TranscriptRecord | null {
  const content = isRecord(record.message) ? record.message.content : null
  const text = envelopeText(content)
  if (text === null) return null
  if (text.startsWith('<local-command-stdout>')) {
    const output = tagged('local-command-stdout', text)
    return output === null
      ? null
      : {
          kind: 'command-output',
          uuid: message.uuid,
          timestamp: message.timestamp,
          text: output,
        }
  }
  if (!text.startsWith('<command-name>') && !text.startsWith('<command-message>')) return null
  const name = tagged('command-name', text)
  if (name === null) return null
  const argumentsText = tagged('command-args', text) ?? ''
  const prompt = argumentsText.length === 0 ? name : `${name} ${argumentsText}`
  return { ...message, blocks: [{ shape: 'prose', text: prompt }] }
}
