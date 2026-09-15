import { isIdentifier, isRecord } from '@/boundary'
import type {
  TranscriptEventKind,
  TranscriptMessage,
  TranscriptRecord,
} from '@/core/sessions/transcript'

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

// These envelopes configure the harness only, so they become hidden traces. They still mark a
// real delivery boundary: Tool Calls either side must not be summarised as one run.
const HIDDEN_HARNESS_ENVELOPES = new Set([
  'apps_instructions',
  'collaboration_mode',
  'local-command-caveat',
  'permissions',
  'plugins_instructions',
  'recommended_plugins',
  'skills_instructions',
])

const HARNESS_EVENTS: Record<
  string,
  { event: TranscriptEventKind; text: (body: string) => string | null; requiresText?: true }
> = {
  'app-context': { event: 'context', text: () => null },
  environment_context: { event: 'context', text: () => null },
  realtime_delegation: {
    event: 'command',
    text: (body) => tagged('input', body)?.trim() || null,
    requiresText: true,
  },
  status: { event: 'status', text: (body) => body.trim() || null },
  transcript_delta: { event: 'transcript', text: () => null },
  transcript_tail_flush: { event: 'transcript', text: () => null },
}

type HarnessEvent = Extract<TranscriptRecord, { kind: 'event' | 'trace' }>

function envelopeName(text: string): string | null {
  const name = /^\s*<([a-z][a-z0-9_-]*)(?:\s[^>]*)?>/i.exec(text)?.[1]
  return name?.toLowerCase() ?? null
}

function isHarnessDelivery(record: Record<string, unknown>): boolean {
  return record.userType === 'external' && typeof record.sourceToolAssistantUUID === 'string'
}

function completeEnvelope(text: string, name: string): string | null {
  return (
    new RegExp(`^\\s*<${name}(?:\\s[^>]*)?>([\\s\\S]*)</${name}>\\s*$`, 'i').exec(text)?.[1] ?? null
  )
}

function harnessEvent(record: Record<string, unknown>, text: string): HarnessEvent | null {
  const name = envelopeName(text)
  if (!isHarnessDelivery(record) || name === null) return null
  const body = completeEnvelope(text, name)
  if (body === null) return null
  if (HIDDEN_HARNESS_ENVELOPES.has(name)) return { kind: 'trace', uuid: '', boundary: true }
  const presentation = Object.hasOwn(HARNESS_EVENTS, name) ? HARNESS_EVENTS[name] : undefined
  if (presentation === undefined) return null
  const eventText = presentation.text(body)
  if (presentation.requiresText && eventText === null) return { kind: 'trace', uuid: '' }
  return { kind: 'event', uuid: '', event: presentation.event, text: eventText }
}

function trimmedTag(text: string, tag: string): string | null {
  return tagged(tag, text)?.trim() || null
}

function identifierTag(text: string, tag: string): string | null {
  const value = trimmedTag(text, tag)
  return value !== null && isIdentifier(value) ? value : null
}

function readRealtimeDelegation(
  record: Record<string, unknown>,
  message: TranscriptMessage,
  text: string,
): TranscriptRecord | null {
  if (!isHarnessDelivery(record) || envelopeName(text) !== 'realtime_delegation') return null
  const body = completeEnvelope(text, 'realtime_delegation')
  if (body === null) return { kind: 'trace', uuid: message.uuid }
  const action = trimmedTag(body, 'input')
  if (action === null) return { kind: 'trace', uuid: message.uuid }
  return {
    kind: 'delegation',
    uuid: message.uuid,
    actor: 'agent',
    action,
    status: trimmedTag(body, 'status'),
    progress: trimmedTag(body, 'progress'),
    groupId: identifierTag(body, 'id'),
  }
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
  const delegation = readRealtimeDelegation(record, message, text)
  if (delegation !== null) return delegation
  const event = harnessEvent(record, text)
  if (event !== null)
    return event.kind === 'trace'
      ? { ...event, uuid: message.uuid }
      : { ...message, blocks: [{ shape: 'event', event: event.event, text: event.text }] }
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
    return {
      kind: 'delegation',
      uuid: message.uuid,
      actor: 'shell',
      action: summary?.trim() || null,
      status: trimmedTag(text, 'status'),
      progress: null,
      groupId: identifierTag(text, 'task-id'),
    }
  }
  // The harness re-delivers the compaction summary as a synthetic user turn so the model can
  // resume from it; the reader already sees that boundary as the 'compacted' marker row (#2206).
  if (text.startsWith('This session is being continued from a previous conversation'))
    return { kind: 'trace', uuid: message.uuid }
  const prompt = readCommandPrompt(text)
  if (prompt === undefined) return null
  if (prompt === null) return { kind: 'trace', uuid: message.uuid }
  return { ...message, blocks: [{ shape: 'event', event: 'command', text: prompt }] }
}
