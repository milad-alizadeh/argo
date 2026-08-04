import type { ToolCall, ToolResult, Usage } from '../../shared'
import { outputResultFrom } from './toolOutput'
import { diffResultFrom } from './toolResult'
import { asString, isRecord, timestampMs } from './untrusted'

// What a `tool_result` record says about the call it answers: the timestamp, the spend beside
// `message`, and the patch under `toolUseResult` — three readings of one record, kept off the tree
// builder so that builder stays about segmentation.

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
 * What one resolved call produced, kinded — its patch where it mutated, otherwise what it printed.
 *
 * The patch is read only for the calls whose kind SAYS they mutate. A record can carry one beside
 * any call; reading it onto a `read` would put a diff under a row that changed nothing.
 *
 * Output is kept only where a ROW reads it: a command shows what it printed, and a failure of any
 * kind shows what went wrong. A successful read's output is the whole file, and the quiet row it
 * folds into never shows one — holding every file a session read would be the feed's largest cost
 * for a payload nothing renders. A `delegate` keeps none either: the work it printed is the
 * subagent's, and the Subagents section owns it.
 */
function callResult(call: ToolCall, context: ResultContext, content: unknown): ToolResult | null {
  if (call.kind === 'edit') {
    const diff = diffResultFrom(context.toolUseResult)
    if (diff !== null) return diff
  }
  if (call.kind === 'delegate') return null
  const read = call.kind === 'execute' || call.status === 'failed'
  return read ? outputResultFrom(content) : null
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
    call.result = callResult(call, context, part.content)
  }
  return true
}
