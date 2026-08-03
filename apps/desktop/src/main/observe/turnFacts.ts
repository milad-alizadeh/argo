import type { Prose, StopReason, Turn } from '../../shared'
import { asArray, asNumber, asString, isRecord } from './untrusted'

// The per-record readings a Turn is folded from, kept beside the fold rather than inside it.

// CC's own stop reasons mapped onto ACP's enum. `tool_use` and an absent reason mean the Turn is
// still going, so they map to null. Anything else CC might write (`stop_sequence`) has no ACP
// counterpart and lands on `unknown` rather than being bent into the nearest-looking member.
const ACP_STOP_REASONS: Readonly<Record<string, StopReason>> = {
  end_turn: 'end_turn',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
}

export function mapStopReason(raw: unknown): StopReason | null {
  const value = asString(raw)
  if (value === null || value === 'tool_use') return null
  return ACP_STOP_REASONS[value] ?? 'unknown'
}

/** Token telemetry off one assistant record; absent rather than zeroed when unreported. */
export function usageFrom(message: Record<string, unknown>): Turn['usage'] {
  const usage = message.usage
  if (!isRecord(usage)) return null
  return {
    inputTokens: asNumber(usage.input_tokens) ?? 0,
    outputTokens: asNumber(usage.output_tokens) ?? 0,
    cacheReadTokens: asNumber(usage.cache_read_input_tokens) ?? 0,
    cacheCreationTokens: asNumber(usage.cache_creation_input_tokens) ?? 0,
  }
}

/**
 * The spend a `tool_result` record reports for the call it answers, off `toolUseResult` — the same
 * token shape the assistant records use, one level down.
 *
 * This is where a Subagent's tokens live and the ONLY place they are visible: its own turns run in
 * a sidechain the parent transcript does not attribute, so without this reading a delegate's whole
 * spend would be invisible rather than merely untiered. Absent for every call whose host reported
 * none, which is every non-delegating one.
 */
export function reportedUsage(record: Record<string, unknown>): Turn['usage'] {
  return isRecord(record.toolUseResult) ? usageFrom(record.toolUseResult) : null
}

export function contentParts(record: Record<string, unknown>): unknown[] {
  return isRecord(record.message) ? asArray(record.message.content) : []
}

/** One content part as prose, or `null` for a part that is neither — a tool call, or a `text` block
 * whose text is not a string. Absent rather than defaulted: an empty paragraph would render as a
 * blank row claiming the agent said nothing, which is not what an unreadable part means. */
export function proseFrom(part: unknown): Prose | null {
  if (!isRecord(part)) return null
  if (part.type === 'text') {
    const markdown = asString(part.text)
    return markdown === null ? null : { kind: 'message', markdown }
  }
  if (part.type !== 'thinking') return null
  const markdown = asString(part.thinking)
  return markdown === null ? null : { kind: 'thought', markdown }
}

/**
 * The prompt that opened a Turn, verbatim: a user message's content is either a raw string or an
 * array of parts, and the first textual part is the prompt.
 *
 * Unclamped and untrimmed, unlike the session title's reading of the same field — the feed renders
 * the prompt as the agent received it, and trimming a prompt is already a rewording. Whitespace
 * alone is `null`, since there is no prompt in it to keep.
 */
export function promptText(content: unknown): string | null {
  const parts = typeof content === 'string' ? [content] : asArray(content)
  for (const part of parts) {
    const text = spokenText(part)
    if (text !== null && text.trim() !== '') return text
  }
  return null
}

// A `text` part or a bare string, and nothing else: `thinking` inside a user record would be the
// agent's reasoning rather than anything the user asked for.
function spokenText(part: unknown): string | null {
  if (typeof part === 'string') return part
  const prose = proseFrom(part)
  return prose !== null && prose.kind === 'message' ? prose.markdown : null
}

export function emptyTurn(id: string, startedAtMs: number | null): Turn {
  return {
    id,
    stopReason: null,
    prompt: null,
    prose: [],
    toolCalls: [],
    plan: null,
    usage: null,
    startedAtMs,
    endedAtMs: null,
  }
}
