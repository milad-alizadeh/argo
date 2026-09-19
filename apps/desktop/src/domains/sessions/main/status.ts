// The Session status reading for a Session observed from OUTSIDE (CONTEXT.md L2 · Session
// status). External floors at `running · asking? · idle · unknown`, with `stopped` where the
// record carries a stop reason inside Argo's vocabulary.
//
// `running` is not reachable from this module and that is the degrade-down rule working rather
// than a gap: corroborating an open Turn externally needs process-match plus mtime liveness,
// which this slice does not observe, so an open Turn reads `unknown`. `starting`, `permission`
// and `ended` are managed-only or need an exit Argo witnessed, and no external posture has one.

import { SESSION_STATUSES, type SessionStatus } from '../contract/models'
import type { TranscriptMessage, TranscriptRecord } from '../contract/transcript'

export type { SessionStatus }
// The closed set, written once. The type is derived from it rather than restated beside it, so a
// status added here reaches the boundary check and the drawn word without a second edit.
export { SESSION_STATUSES }

const ENDED_TURN = 'end_turn'
const STOPPED_REASONS = ['max_tokens', 'max_turn_requests', 'refusal']
// Not a Turn end. The assistant yielded to a tool and the same Turn continues, so a record
// carrying this leaves the Turn OPEN rather than closing it on a word outside the vocabulary.
const CONTINUES_TURN = 'tool_use'

// The one external reading of `asking` the glossary allows: pending has to be CONFIRMABLE from
// the record. A structured question in the last assistant record that no later record answers
// is confirmable; anything softer would be a fabricated `asking`. Shared with the Claude adapter's
// own pending-question read (`agents/claude/sessions/pending-question.ts`), which names the call
// it found rather than only a boolean.
export function pendingAskCall(messages: TranscriptMessage[]): string | null {
  const last = messages.at(-1)
  if (last === undefined || last.role !== 'assistant') return null
  const answered = new Set(messages.flatMap((message) => message.answeredCalls))
  const pending = last.toolCalls.find((call) => call.ask !== undefined && !answered.has(call.id))
  return pending?.id ?? null
}

function isAskPending(messages: TranscriptMessage[]): boolean {
  return pendingAskCall(messages) !== null
}

export function readExternalStatus(
  messages: TranscriptMessage[],
  records: readonly TranscriptRecord[] = messages,
): SessionStatus {
  const boundary = records.findLast((record) => record.kind === 'message' || record.kind === 'turn')
  if (boundary?.kind === 'turn') return 'idle'
  if (isAskPending(messages)) return 'asking'
  const last = messages.at(-1)
  // Nothing observed is a different claim from observed to be quiet, and an open Turn nothing
  // corroborates says nothing about this Turn. Both land on `unknown`, never on `idle`.
  if (last === undefined || last.role !== 'assistant') return 'unknown'
  const reason = last.stopReason
  if (reason === null || reason === CONTINUES_TURN) return 'unknown'
  if (reason === ENDED_TURN) return 'idle'
  if (STOPPED_REASONS.includes(reason)) return 'stopped'
  // A stop reason outside the vocabulary is `unknown`, never the nearest guess.
  return 'unknown'
}
