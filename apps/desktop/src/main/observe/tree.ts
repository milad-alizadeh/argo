import { addUsage, type Compaction, type ToolCall, type Turn, type Usage } from '../../shared'
import {
  DELEGATING_TOOLS,
  PLAN_TOOL,
  planFrom,
  type SubagentSeed,
  subagentFrom,
  toolCallFrom,
} from './toolCalls'
import { contentParts, emptyTurn, mapStopReason, reportedUsage, usageFrom } from './turnFacts'
import { asString, isRecord, timestampMs } from './untrusted'

// One file's slice of the runtime tree, folded out of its records in order. Turns are segmented
// prompt-in → stop-reason-out; a reason the record does not carry is `unknown`, never a guess.

export interface ParsedTree {
  turns: Turn[]
  compactions: Compaction[]
  subagents: SubagentSeed[]
}

/** A delegating call held with the input it was made with, so its Subagent can be built at `finish`
 * — by which point the call's `tool_result` has been read and the subagent has an end time. */
interface Delegation {
  call: ToolCall
  input: unknown
}

interface TreeState extends Omit<ParsedTree, 'subagents'> {
  delegations: Delegation[]
  callsById: Map<string, ToolCall>
  current: Turn | null
  compactionPending: boolean
}

// A new prompt means the previous Turn is over. If no stop reason was ever recorded for it the
// honest reading is `unknown` — the transcript simply stopped speaking for it.
function beginTurn(state: TreeState, id: string, atMs: number | null): Turn {
  if (state.current !== null && state.current.stopReason === null) {
    state.current.stopReason = 'unknown'
  }
  const turn = emptyTurn(id, atMs)
  state.turns.push(turn)
  if (state.compactionPending) {
    state.compactions.push({ beforeTurnId: id })
    state.compactionPending = false
  }
  state.current = turn
  return turn
}

/** The turn a call is being folded into, and when the record carrying it landed. */
interface CallContext {
  turn: Turn
  atMs: number | null
}

function absorbCall(state: TreeState, { turn, atMs }: CallContext, part: unknown): void {
  const call = toolCallFrom(part, atMs)
  if (call === null) return
  turn.toolCalls.push(call)
  state.callsById.set(call.id, call)
  const input = isRecord(part) ? part.input : null
  if (DELEGATING_TOOLS.includes(call.name)) state.delegations.push({ call, input })
  if (call.name === PLAN_TOOL) turn.plan = planFrom(input) ?? turn.plan
}

/** What the record carrying a `tool_result` says about the call, beside the result part itself:
 * when it landed, and the host's own report of what the call spent. */
interface ResultContext {
  atMs: number | null
  usage: Usage | null
}

// A tool_result is the only thing that moves a call off `pending`, and the record carrying it is
// when the call ended. An unmatched id is ignored: it belongs to a call this file never saw (a
// resumed chain), not to a call we can invent.
function resolveResult(state: TreeState, { atMs, usage }: ResultContext, part: unknown): boolean {
  if (!isRecord(part) || part.type !== 'tool_result') return false
  const call = state.callsById.get(asString(part.tool_use_id) ?? '')
  if (call) {
    call.status = part.is_error === true ? 'failed' : 'completed'
    call.endedAtMs = atMs
    call.usage = usage
  }
  return true
}

function closeTurn(state: TreeState, turn: Turn, record: Record<string, unknown>): void {
  if (!isRecord(record.message)) return
  const usage = usageFrom(record.message)
  if (usage) turn.usage = turn.usage ? addUsage(turn.usage, usage) : usage
  const stop = mapStopReason(record.message.stop_reason)
  if (stop === null) return
  turn.stopReason = stop
  turn.endedAtMs = timestampMs(record)
  state.current = null
}

function absorbAssistant(state: TreeState, record: Record<string, unknown>): void {
  const uuid = asString(record.uuid)
  if (uuid === null) return
  const atMs = timestampMs(record)
  // An assistant record with no prompt in front of it (a chain resumed mid-turn) still gets a
  // Turn keyed to itself, so its tool calls are reported rather than dropped.
  const turn = state.current ?? beginTurn(state, uuid, atMs)
  for (const part of contentParts(record)) absorbCall(state, { turn, atMs }, part)
  closeTurn(state, turn, record)
}

function absorbUser(state: TreeState, record: Record<string, unknown>): void {
  // The compact summary is written AS a user record; it marks the seam, it is not a prompt.
  if (record.isCompactSummary === true) {
    state.compactionPending = true
    return
  }
  // The spend a delegating call reports sits on the RECORD, beside `message` rather than inside the
  // result part — so it is read here and handed down with the timestamp.
  const context: ResultContext = { atMs: timestampMs(record), usage: reportedUsage(record) }
  const resolved = contentParts(record).map((part) => resolveResult(state, context, part))
  if (resolved.some(Boolean)) return
  const uuid = asString(record.uuid)
  if (uuid !== null) beginTurn(state, uuid, context.atMs)
}

export interface TreeBuilder {
  absorb(record: Record<string, unknown>): void
  finish(): ParsedTree
}

export function createTreeBuilder(): TreeBuilder {
  const state: TreeState = {
    turns: [],
    compactions: [],
    delegations: [],
    callsById: new Map(),
    current: null,
    compactionPending: false,
  }

  return {
    absorb(record) {
      // A sidechain record is a Subagent's own transcript. The parent's delegating Tool Call is
      // what makes the Subagent node; its interior turns are not attributable to the root, so
      // they are left out rather than folded into the parent's sequence.
      if (record.isSidechain === true) return
      if (record.type === 'user') absorbUser(state, record)
      if (record.type === 'assistant') absorbAssistant(state, record)
    },
    // Subagents are built HERE rather than where they were spawned: a delegating call's end time
    // only arrives with its `tool_result`, so a seed taken at spawn would fix every subagent as
    // still running.
    finish: () => ({
      turns: state.turns,
      compactions: state.compactions,
      subagents: state.delegations.map(({ call, input }) => subagentFrom(call, input)),
    }),
  }
}
