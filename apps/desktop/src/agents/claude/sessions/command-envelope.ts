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

// Harness-only envelopes stay at the parser boundary so their markup never reaches the Feed.
const HIDDEN_HARNESS_ENVELOPES = new Set([
  'app-context',
  'apps_instructions',
  'collaboration_mode',
  'environment_context',
  'local-command-caveat',
  'permissions',
  'plugins_instructions',
  'recommended_plugins',
  'realtime_delegation',
  'skills_instructions',
  'status',
  'transcript_delta',
  'transcript_tail_flush',
])

function envelopeName(text: string): string | null {
  const name = /^\s*<([a-z][a-z0-9_-]*)(?:\s[^>]*)?>/i.exec(text)?.[1]
  return name?.toLowerCase() ?? null
}

function isHarnessDelivery(record: Record<string, unknown>): boolean {
  return record.userType === 'external' && typeof record.sourceToolAssistantUUID === 'string'
}

function hiddenHarnessEnvelope(record: Record<string, unknown>, text: string): boolean {
  const name = envelopeName(text)
  if (!isHarnessDelivery(record) || name === null || !HIDDEN_HARNESS_ENVELOPES.has(name)) {
    return false
  }
  return new RegExp(`^\\s*<${name}(?:\\s[^>]*)?>[\\s\\S]*</${name}>\\s*$`, 'i').test(text)
}

function readCommandPrompt(text: string): string | null | undefined {
  if (!text.startsWith('<command-name>') && !text.startsWith('<command-message>')) return undefined
  const name = tagged('command-name', text)
  const command = name ?? tagged('command-message', text)
  if (command === null) return null
  const argumentsText = tagged('command-args', text) ?? ''
  return name === null || argumentsText.length === 0 ? command : `${name} ${argumentsText}`
}

export function readCommandEnvelope(
  record: Record<string, unknown>,
  message: TranscriptMessage,
): TranscriptRecord | null {
  const content = isRecord(record.message) ? record.message.content : null
  const text = envelopeText(content)
  if (text === null) return null
  if (hiddenHarnessEnvelope(record, text)) return { kind: 'trace', uuid: message.uuid }
  if (text.startsWith('<local-command-stdout>')) {
    const output = tagged('local-command-stdout', text)
    return output === null
      ? { kind: 'trace', uuid: message.uuid }
      : {
          kind: 'command-output',
          uuid: message.uuid,
          timestamp: message.timestamp,
          text: output,
        }
  }
  // A background task's delivery is not the person's own words: it is the CLI handing back a
  // summary, with the task's full JSON result attached for the model, not the reader.
  if (text.startsWith('<task-notification>')) {
    const summary = tagged('summary', text)
    return summary === null
      ? { kind: 'trace', uuid: message.uuid }
      : {
          kind: 'command-output',
          uuid: message.uuid,
          timestamp: message.timestamp,
          text: summary,
        }
  }
  const prompt = readCommandPrompt(text)
  if (prompt === undefined) return null
  if (prompt === null) return { kind: 'trace', uuid: message.uuid }
  return { ...message, blocks: [{ shape: 'prose', text: prompt }] }
}
