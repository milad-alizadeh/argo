import { addUsage, type Compaction, type ToolCall, type Turn } from '../../shared'
import { resolveResult, resultContext } from './callResults'
import { isHarnessMeta, localCommandCall, localCommandOutput, userPrompt } from './harnessRecord'
import { type ImageReader, NO_IMAGE_READER } from './mediaResult'
import {
  DELEGATING_TOOLS,
  PLAN_TOOL,
  planFrom,
  type SubagentSeed,
  subagentFrom,
  toolCallFrom,
} from './toolCalls'
import {
  contentParts,
  emptyTurn,
  mapStopReason,
  proseFrom,
  reportedUsage,
  usageFrom,
} from './turnFacts'
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
  /** The fallback for an image the record embedded no bytes for. Held on the state rather than
   * reached for globally, so a parse with no reader has no fallback instead of a fabricated one. */
  readImage: ImageReader
}

/** What opens a Turn: the record's own id, when it landed, and the prompt it carried — `null` for a
 * turn no prompt opened, which is a chain resumed mid-turn rather than a prompt of nothing. */
interface TurnOpening {
  id: string
  atMs: number | null
  prompt: string | null
}

// A new prompt means the previous Turn is over. If no stop reason was ever recorded for it the
// honest reading is `unknown` — the transcript simply stopped speaking for it.
function beginTurn(state: TreeState, { id, atMs, prompt }: TurnOpening): Turn {
  if (state.current !== null && state.current.stopReason === null) {
    state.current.stopReason = 'unknown'
  }
  const turn = emptyTurn(id, atMs)
  turn.prompt = prompt
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

/** One content part folded into its Turn: prose if it is prose, a tool call if it is a call. Both
 * live in `content`, so one reader takes them apart rather than two passes over the same array. */
function absorbPart(state: TreeState, { turn, atMs }: CallContext, part: unknown): void {
  const prose = proseFrom(part)
  if (prose !== null) {
    turn.prose.push(prose)
    return
  }
  const call = toolCallFrom(part, { atMs, proseIndex: turn.prose.length })
  if (call === null) return
  turn.toolCalls.push(call)
  state.callsById.set(call.id, call)
  const input = isRecord(part) ? part.input : null
  if (DELEGATING_TOOLS.includes(call.name)) state.delegations.push({ call, input })
  if (call.name === PLAN_TOOL) turn.plan = planFrom(input) ?? turn.plan
}

function closeTurn(state: TreeState, turn: Turn, record: Record<string, unknown>): void {
  if (!isRecord(record.message)) return
  const usage = usageFrom(record.message)
  if (usage) {
    turn.usage = turn.usage ? addUsage(turn.usage, usage) : usage
    // The window this record re-read, REPLACING the last reading rather than adding to it: every
    // request in a turn re-reads one window, so the newest record is what is in the model's head
    // now and the sum of them is a number that never existed.
    turn.contextTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
  }
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
  // Turn keyed to itself, so its tool calls are reported rather than dropped. Its prompt is absent
  // rather than empty: there was one, this file just does not carry it.
  const turn = state.current ?? beginTurn(state, { id: uuid, atMs, prompt: null })
  for (const part of contentParts(record)) absorbPart(state, { turn, atMs }, part)
  closeTurn(state, turn, record)
}

function absorbUser(state: TreeState, record: Record<string, unknown>): void {
  // The compact summary is written AS a user record; it marks the seam, it is not a prompt.
  if (record.isCompactSummary === true) {
    state.compactionPending = true
    return
  }
  // The spend a delegating call reports sits on the RECORD, beside `message` rather than inside the
  // result part — so it is read here and handed down with the timestamp and the patch.
  const context = resultContext(record, reportedUsage(record), state.readImage)
  const resolved = contentParts(record).map((part) => resolveResult(state.callsById, context, part))
  if (resolved.some(Boolean)) return
  // Not every user record is a prompt, and reading one that is not opens a Turn nobody asked for.
  // The harness writes several per exchange — the local-command caveat, a skill's expanded body,
  // the `[Image: …]` preamble in front of a paste — and a real `/implement` run splits into twelve
  // turns instead of two, ten of them empty and each titled with the CLI's own plumbing.
  if (isHarnessMeta(record)) return
  const uuid = asString(record.uuid)
  if (uuid === null) return
  const content = isRecord(record.message) ? record.message.content : null
  // A local command's stdout is not a prompt — it is the ANSWER to the one in front of it, so it
  // joins that turn as what the command produced rather than opening a turn of its own. Dropped
  // where there is no open turn: output with no invocation above it belongs to nothing, and a turn
  // synthesized to hold it would be a turn nobody opened.
  const printed = localCommandOutput(content)
  if (printed !== null) {
    const turn = state.current
    if (turn !== null) {
      turn.toolCalls.push(localCommandCall(turn, { id: uuid, atMs: context.atMs, printed }))
    }
    return
  }
  // The prompt is read from the same record that opens the turn, so a Turn's cause and its id come
  // from one reading rather than being matched up afterwards.
  const prompt = userPrompt(content)
  if (prompt === null) return
  beginTurn(state, { id: uuid, atMs: context.atMs, prompt })
}

export interface TreeBuilder {
  absorb(record: Record<string, unknown>): void
  finish(): ParsedTree
}

export function createTreeBuilder(
  readImage: ImageReader = NO_IMAGE_READER,
  /** This file is a delegate's OWN transcript, so its sidechain records are its content rather
   * than another agent's work spliced into it. Off by default — the common read is a parent. */
  sidechain = false,
): TreeBuilder {
  const state: TreeState = {
    turns: [],
    compactions: [],
    delegations: [],
    callsById: new Map(),
    current: null,
    compactionPending: false,
    readImage,
  }

  return {
    absorb(record) {
      // A sidechain record is a Subagent's own transcript. Folding those into the file being read
      // would splice a second agent's work into this one's sequence — so they are skipped HERE,
      // where the file is the parent's.
      //
      // `sidechain: true` is how a caller says "this file IS the delegate's". Without it the
      // builder could never read one at all: a subagent's file is sidechain records end to end, so
      // the same guard that protects the parent silently returned an empty tree for the child.
      if (record.isSidechain === true && !sidechain) return
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
