import { type ImageReader, NO_IMAGE_READER } from './mediaResult'
import { createTreeBuilder } from './tree'
import { promptText } from './turnFacts'
import type { ParsedTranscript } from './types'
import { asString, isRecord, parseLine, stringField, timestampMs } from './untrusted'

// THE untrusted-input boundary: one raw .jsonl becomes one tamed ParsedTranscript. A model
// wrote it, so every line is parsed defensively (a malformed line is skipped, never thrown),
// only string-typed fields are accepted, and no prose claim is ever lifted into a fact. The
// runtime tree is folded in the same pass, so a record is read once.

const PROMPT_CLAMP = 120

// The session's TITLE reading of the same prompt the runtime tree keeps verbatim: trimmed and
// clamped, because a rail row has one line to spend. The two readings share one parse so a prompt
// can never be found for the tree and missed for the title.
function coercePromptText(content: unknown): string | null {
  const text = promptText(content)
  return text === null ? null : text.trim().slice(0, PROMPT_CLAMP)
}

/** A transcript before a single record has been read: every derived fact absent, not defaulted. */
export function emptyTranscript(sessionId: string): ParsedTranscript {
  return {
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
}

/**
 * One raw transcript's lines → one tamed ParsedTranscript.
 *
 * `readImage` is the disk fallback for an image the record embedded no bytes for, defaulted to none:
 * a caller that supplies no reader gets only what the record itself carried, which is the honest
 * floor rather than a silently missing feature.
 */
export function parseTranscript(
  sessionId: string,
  lines: string[],
  readImage: ImageReader = NO_IMAGE_READER,
): ParsedTranscript {
  const tree = createTreeBuilder(readImage)
  const parsed = emptyTranscript(sessionId)

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
