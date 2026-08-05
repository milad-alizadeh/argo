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

/**
 * One content part as prose, or `null` for a part that is neither — a tool call, or a `text` block
 * whose text is not a string.
 *
 * Absent rather than defaulted, and WHITESPACE counts as absent: a part with nothing in it is a
 * part with nothing to read, and a row rendered for one is a row claiming the agent said something
 * it did not. That case is not hypothetical — a model whose reasoning is encrypted writes its
 * `thinking` blocks out empty, so a real session carries seventy of them, and each one drew a
 * collapsed row whose one line was blank.
 */
export function proseFrom(part: unknown): Prose | null {
  if (!isRecord(part)) return null
  if (part.type === 'text') return message(asString(part.text))
  if (part.type !== 'thinking') return null
  const markdown = asString(part.thinking)
  return markdown === null || markdown.trim() === '' ? null : { kind: 'thought', markdown }
}

const message = (markdown: string | null): Prose | null =>
  markdown === null || markdown.trim() === '' ? null : { kind: 'message', markdown }

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
