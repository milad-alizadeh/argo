import type { ParsedTranscript } from './types'

// THE untrusted-input boundary: one raw .jsonl becomes one tamed ParsedTranscript. A model
// wrote it, so every line is parsed defensively (a malformed line is skipped, never thrown),
// only string-typed fields are accepted, and no prose claim is ever lifted into a fact.

const PROMPT_CLAMP = 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

// A user message's content is either a raw string or an array of parts; take the first
// textual part so a title can be derived from it. Never infer meaning beyond the text.
function coercePromptText(content: unknown): string | null {
  if (typeof content === 'string') return clampPrompt(content)
  if (!Array.isArray(content)) return null
  for (const part of content) {
    if (typeof part === 'string') return clampPrompt(part)
    if (isRecord(part) && part.type === 'text' && typeof part.text === 'string') {
      return clampPrompt(part.text)
    }
  }
  return null
}

function clampPrompt(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  return trimmed.slice(0, PROMPT_CLAMP)
}

function timestampMs(record: Record<string, unknown>): number | null {
  const raw = asString(record.timestamp)
  if (raw === null) return null
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

export function parseTranscript(sessionId: string, lines: string[]): ParsedTranscript {
  const parsed: ParsedTranscript = {
    sessionId,
    headLeafUuid: null,
    messageUuids: [],
    cwd: null,
    aiTitle: null,
    firstPrompt: null,
    lastTimestampMs: null,
  }

  for (const line of lines) {
    const record = parseLine(line)
    if (record === null) continue
    absorb(parsed, record)
  }

  return parsed
}

function parseLine(line: string): Record<string, unknown> | null {
  if (line.trim() === '') return null
  try {
    const value: unknown = JSON.parse(line)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

// Fold one record into the accumulator. Only the transcript types that carry chain or
// title facts are recognised; every other type (mode, system, bridge-session, …) is ignored.
function absorb(parsed: ParsedTranscript, record: Record<string, unknown>): void {
  switch (record.type) {
    case 'last-prompt': {
      const leaf = asString(record.leafUuid)
      if (leaf !== null && parsed.headLeafUuid === null) parsed.headLeafUuid = leaf
      return
    }
    case 'ai-title': {
      const title = asString(record.aiTitle)
      if (title !== null && parsed.aiTitle === null) parsed.aiTitle = title
      return
    }
    case 'user': {
      absorbMessage(parsed, record)
      const content = isRecord(record.message) ? record.message.content : null
      const prompt = coercePromptText(content)
      if (prompt !== null && parsed.firstPrompt === null) parsed.firstPrompt = prompt
      return
    }
    case 'assistant':
    case 'attachment': {
      absorbMessage(parsed, record)
      return
    }
    default:
      return
  }
}

// Shared across the message-bearing record types: uuid feeds the resume chain; cwd and
// timestamp keep their first-non-null / newest reading.
function absorbMessage(parsed: ParsedTranscript, record: Record<string, unknown>): void {
  const uuid = asString(record.uuid)
  if (uuid !== null) parsed.messageUuids.push(uuid)

  const cwd = asString(record.cwd)
  if (cwd !== null && parsed.cwd === null) parsed.cwd = cwd

  const ms = timestampMs(record)
  if (ms !== null && (parsed.lastTimestampMs === null || ms > parsed.lastTimestampMs)) {
    parsed.lastTimestampMs = ms
  }
}
