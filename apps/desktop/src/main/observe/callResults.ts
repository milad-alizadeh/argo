import type { ToolCall, Usage } from '../../shared'
import { diffResultFrom } from './toolResult'
import { asString, isRecord, timestampMs } from './untrusted'

// What a `tool_result` record says about the call it answers. Its own file because the reading has
// three sources on ONE record — the timestamp, the spend beside `message`, and the patch under
// `toolUseResult` — and folding them into the tree builder made that builder about results.

/** What the record carrying a `tool_result` says about the call, beside the result part itself: when
 * it landed, the host's own report of what the call spent, and the patch it applied. */
export interface ResultContext {
  atMs: number | null
  usage: Usage | null
  toolUseResult: unknown
}

export function resultContext(record: Record<string, unknown>, usage: Usage | null): ResultContext {
  return { atMs: timestampMs(record), usage, toolUseResult: record.toolUseResult }
}

/**
 * One `tool_result` part folded onto the call it answers. Returns whether the part WAS one, which is
 * how the caller tells a result record from a prompt record.
 *
 * A tool_result is the only thing that moves a call off `pending`, and the record carrying it is
 * when the call ended. An unmatched id is ignored: it belongs to a call this file never saw (a
 * resumed chain), not to a call we can invent.
 */
export function resolveResult(
  calls: Map<string, ToolCall>,
  context: ResultContext,
  part: unknown,
): boolean {
  if (!isRecord(part) || part.type !== 'tool_result') return false
  const call = calls.get(asString(part.tool_use_id) ?? '')
  if (call) {
    call.status = part.is_error === true ? 'failed' : 'completed'
    call.endedAtMs = context.atMs
    call.usage = context.usage
    // The patch is kept only for the calls whose kind SAYS they mutate. A record can carry one
    // beside any call; reading it onto a `read` would put a diff under a row that changed nothing.
    if (call.kind === 'edit') call.result = diffResultFrom(context.toolUseResult)
  }
  return true
}
