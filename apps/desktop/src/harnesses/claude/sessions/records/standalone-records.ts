import type {
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript/transcript'
import { commandSource } from './command-source'
import { messageEnvelope } from './message-envelope'

function setupRecord(record: Record<string, unknown>): TranscriptRecord | null {
  if (record.type !== 'permission-mode' || typeof record.permissionMode !== 'string') return null
  return {
    kind: 'setup',
    startsTurn: false,
    model: null,
    effort: null,
    mode: record.permissionMode,
  }
}

function localCommandRecord(record: Record<string, unknown>): TranscriptRecord | null {
  if (
    record.type !== 'system' ||
    record.subtype !== 'local_command' ||
    typeof record.uuid !== 'string' ||
    typeof record.content !== 'string' ||
    (!record.content.startsWith('<command-name>') &&
      !record.content.startsWith('<command-message>'))
  )
    return null
  const command = commandSource(record.content)
  if (command.split(' ')[0] === '/compact') return { kind: 'trace', uuid: record.uuid }
  const message: TranscriptMessage = {
    kind: 'message',
    uuid: record.uuid,
    ...messageEnvelope(record),
    role: 'user',
    entry: record.entrypoint === 'sdk-harness' ? 'headless' : 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    usage: null,
    blocks: [{ shape: 'event', event: 'command', text: command }],
    toolCalls: [],
    toolResults: [],
    answeredCalls: [],
  }
  return message
}

export function readStandaloneRecord(record: Record<string, unknown>): TranscriptRecord | null {
  return setupRecord(record) ?? localCommandRecord(record)
}
