import type { Tier } from './honesty'

// The locked runtime tree (CONTEXT.md L3): Agent · Subagent · Turn · Tool Call · Plan ·
// Compaction · Usage. Names re-derived from what Claude Code / Codex / ACP literally use —
// the `Run` / `Phase` / `Actor` coinages are retired, and with them the `kind: session |
// agent` discriminant: root-vs-child is carried by `parentId` alone.

// ACP's prompt-turn stop reasons, adopted agnostically, plus `unknown` for a record the
// reason cannot be inferred from. A guess here would be a fabricated DIRECT.
export const STOP_REASONS = [
  'end_turn',
  'max_tokens',
  'max_turn_requests',
  'refusal',
  'cancelled',
  'unknown',
] as const

export type StopReason = (typeof STOP_REASONS)[number]

// What the tool did, coarse enough to be CLI-agnostic. The CLI's own tool name travels
// verbatim beside it (`ToolCall.name`), so nothing the host said is renamed away.
export const TOOL_CALL_KINDS = [
  'read',
  'edit',
  'execute',
  'search',
  'fetch',
  'delegate',
  'plan',
  'other',
] as const

export type ToolCallKind = (typeof TOOL_CALL_KINDS)[number]

export const TOOL_CALL_STATUSES = ['pending', 'in_progress', 'completed', 'failed'] as const

export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number]

/** Which side of the change one printed line of a hunk sits on. */
export type DiffLineSide = 'add' | 'del' | 'context'

/** One printed line, without its `+`/`-`/space marker: the SIDE carries that, so a renderer decides
 * once how a side is shown and no consumer has to strip a character back off the text. */
export interface DiffLine {
  side: DiffLineSide
  text: string
}

/** One contiguous run of changed lines with its surrounding context, and where it starts on each
 * side. The line numbers are the host's own — they are what lets a bounded diff say WHERE in the
 * file the hunk it is showing sits. */
export interface DiffHunk {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

/** What a mutation did to the file as a whole. Read from the change itself rather than from the
 * tool's name: `Write` creates and updates, and no CLI has a delete tool at all, so the name cannot
 * tell these apart and the patch can. */
export const FILE_CHANGES = ['create', 'modify', 'delete'] as const

export type FileChange = (typeof FILE_CHANGES)[number]

/**
 * What a mutating call changed, as the record reported it. Zero hunks is the honest reading of a
 * binary or unreadable patch — a renderer says "no diff available" rather than drawing an empty
 * block, and never invents lines to fill it.
 */
export interface DiffResult {
  kind: 'diff'
  tier: Tier
  change: FileChange
  added: number
  removed: number
  hunks: DiffHunk[]
}

/** What a call PRINTED. Declared here so the union is closed; nothing populates it yet — the
 * command rows that will are the next ticket's. */
export interface OutputResult {
  kind: 'output'
  tier: Tier
  text: string
}

/** What a call SHOWED — the bytes the agent actually looked at, not whatever is at that path now.
 * Declared with the union; nothing populates it yet. */
export interface MediaResult {
  kind: 'media'
  tier: Tier
  mediaType: string
  dataUri: string
}

/**
 * What a Tool Call produced, kinded.
 *
 * A named object rather than three loose fields on the call, because the TIER belongs to the
 * payload and not to the call: the same edit can yield the agent's own bytes (what it wrote) or a
 * weaker read from disk, and a fact with two possible provenances needs somewhere to carry which
 * one it was.
 */
export type ToolResult = DiffResult | OutputResult | MediaResult

/** The atomic observable action within a Turn — the unit users watch scroll by. */
export interface ToolCall {
  id: string
  /** The host's own tool name, never normalized. */
  name: string
  kind: ToolCallKind
  status: ToolCallStatus
  /** The file or command the call names, when it names one. */
  target: string | null
  /** What the call produced, once its result has been read. `null` while it is still pending, and
   * for a result of a kind nothing reads yet. */
  result: ToolResult | null
  /** How many prose parts this Turn had emitted when the call was made.
   *
   * Prose and calls arrive in ONE content array and are folded into two lists, so this is the only
   * record of where a call sits in the narrative — and a mutation drawn out of the order it
   * happened in is a timeline that never happened. */
  proseIndex: number
  /** When the agent emitted the call — the timestamp of the record carrying it. */
  atMs: number | null
  /** When its result came back, so a call has a duration and not just a moment. `null` while it is
   * still running, and for a result the record never carried. */
  endedAtMs: number | null
  /** What the call itself reported spending. `null` for the ordinary call, which spends nothing of
   * its own — a DELEGATING call is the case this exists for: its result carries the whole token
   * spend of the subagent it ran, which is the only place that spend is visible at all. */
  usage: Usage | null
}

export const PLAN_ENTRY_STATUSES = ['pending', 'in_progress', 'completed'] as const

export type PlanEntryStatus = (typeof PLAN_ENTRY_STATUSES)[number]

export interface PlanEntry {
  text: string
  status: PlanEntryStatus
}

/** The agent-authored live to-do list within a Turn (ACP `Plan`; CC's TodoWrite maps onto it). */
export interface Plan {
  entries: PlanEntry[]
}

/** Token telemetry, DERIVED, a fact on Turn and rolled up to the Session. */
export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

/** A marker where history was condensed; the resume chain stitches across it. */
export interface Compaction {
  /** The Turn the condensed history sits in front of. */
  beforeTurnId: string
}

/** What the agent SAID within a Turn (ACP `agent_message_chunk`; a `text` block in CC's record).
 * Held verbatim — prose is read, never reworded or summarized. */
export interface Message {
  kind: 'message'
  markdown: string
}

/** What the agent REASONED within a Turn (ACP `agent_thought_chunk`; a `thinking` block). Never
 * read as a Message: the two are different provenance claims, and a Turn's final message routinely
 * contradicts its own reasoning. */
export interface Thought {
  kind: 'thought'
  markdown: string
}

/** The Turn's prose, in ONE sequence rather than two lists. The order the agent emitted them in is
 * the only thing that says which reasoning produced which answer, and two lists lose it. */
export type Prose = Message | Thought

/** One exchange within an Agent: prompt in → stop reason out. */
export interface Turn {
  id: string
  /** null = still in progress (no stop observed); `unknown` = ended, reason not inferable. */
  stopReason: StopReason | null
  /** The prompt that opened this exchange, verbatim. `null` where the record carried none (a chain
   * resumed mid-turn), which is an absent fact and not an empty one. Steering text typed mid-run
   * arrives here too: a steer is a prompt into the same sequence. */
  prompt: string | null
  /** Messages and thoughts in emission order. */
  prose: Prose[]
  toolCalls: ToolCall[]
  plan: Plan | null
  usage: Usage | null
  /** When the prompt that opened this Turn landed. */
  startedAtMs: number | null
  endedAtMs: number | null
}

/**
 * A node in the execution tree, recursive. `parentId === null` marks the root, which is the
 * Session itself — there is no `kind` tag. `label` and `group` are tier-gated: they exist only
 * when the CLI reported them, and are ABSENT rather than invented when it did not.
 */
export interface Agent {
  id: string
  parentId: string | null
  turns: Turn[]
  compactions: Compaction[]
  label?: string
  group?: string
  /** When this agent's work began, and when it ended. Two sources, one field: the root Agent's span
   * runs from its first Turn to its last, and a Subagent's from the delegating Tool Call that
   * spawned it — a Subagent's own interior turns live in a sidechain the parent cannot attribute.
   * `endedAtMs` is `null` while the agent is still working, which is what makes a duration honest:
   * measured against the wall clock rather than against a fabricated end. */
  startedAtMs: number | null
  endedAtMs: number | null
  /** Spend reported for this agent AS A WHOLE, where the host reports one instead of per Turn.
   * `null` on the root Agent, whose spend is on its Turns; a Subagent's is here, because its own
   * turns are in a sidechain the parent cannot attribute and the delegating call's result is the
   * only place its tokens are ever named. */
  usage: Usage | null
}

export function addUsage(left: Usage, right: Usage): Usage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
  }
}

/** The root Agent — the Session's own node. `null` for a tree that could not be parsed at all. */
export function rootAgent(agents: readonly Agent[]): Agent | null {
  return agents.find((agent) => agent.parentId === null) ?? null
}

/** The Turn in progress, if the Agent has one — the signal a Session is `running`. */
export function openTurn(agent: Agent): Turn | null {
  return agent.turns.find((turn) => turn.stopReason === null) ?? null
}
