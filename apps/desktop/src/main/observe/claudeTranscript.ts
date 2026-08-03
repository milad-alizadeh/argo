import { createTreeBuilder } from './tree'
import type { ParsedTranscript } from './types'
import { asArray, asString, isRecord, parseLine, stringField, timestampMs } from './untrusted'

// THE untrusted-input boundary: one raw .jsonl becomes one tamed ParsedTranscript. A model
// wrote it, so every line is parsed defensively (a malformed line is skipped, never thrown),
// only string-typed fields are accepted, and no prose claim is ever lifted into a fact. The
// runtime tree is folded in the same pass, so a record is read once.

const PROMPT_CLAMP = 120

// A user message's content is either a raw string or an array of parts; take the first
// textual part so a title can be derived from it. Never infer meaning beyond the text.
function coercePromptText(content: unknown): string | null {
  if (typeof content === 'string') return clampPrompt(content)
  for (const part of asArray(content)) {
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

export function parseTranscript(sessionId: string, lines: string[]): ParsedTranscript {
  const tree = createTreeBuilder()
  const parsed: ParsedTranscript = {
    sessionId,
    headLeafUuid: null,
    messageUuids: [],
    cwd: null,
    model: null,
    gitBranch: null,
    aiTitle: null,
    firstPrompt: null,
    firstTimestampMs: null,
    lastTimestampMs: null,
    tree: { turns: [], compactions: [], subagents: [] },
  }

  for (const line of lines) {
    const record = parseLine(line)
    if (record === null) continue
    absorb(parsed, record)
    tree.absorb(record)
  }

  parsed.tree = tree.finish()
  return parsed
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
    case 'assistant': {
      absorbMessage(parsed, record)
      // Only an assistant record names a model, and records run oldest → newest, so the last
      // one read is what the session is on NOW — the rail's question, not what it started on.
      const model = stringField(record.message, 'model')
      if (model !== null) parsed.model = model
      return
    }
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

  // Unlike cwd, the branch takes its LATEST reading: a run can switch branch mid-session and
  // the rail shows where it is now. A record without one leaves the previous reading standing.
  const gitBranch = asString(record.gitBranch)
  if (gitBranch !== null) parsed.gitBranch = gitBranch

  const ms = timestampMs(record)
  if (ms === null) return
  if (parsed.firstTimestampMs === null || ms < parsed.firstTimestampMs) {
    parsed.firstTimestampMs = ms
  }
  if (parsed.lastTimestampMs === null || ms > parsed.lastTimestampMs) {
    parsed.lastTimestampMs = ms
  }
}
