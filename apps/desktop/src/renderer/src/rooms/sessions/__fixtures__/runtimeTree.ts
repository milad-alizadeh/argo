import type { Agent, PlanEntry, ToolCall, Turn, Usage } from '@shared'

// Builders for the locked runtime tree, shared by the interior's derivation tests and its stories.
// One home for the shape so a field added to `Turn` is a compile error in one place rather than in
// every fixture that happened to spell the whole object out.

export const aUsage = (over: Partial<Usage> = {}): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  ...over,
})

export const aToolCall = (over: Partial<ToolCall> & { id: string }): ToolCall => ({
  name: 'Read',
  kind: 'read',
  status: 'completed',
  target: null,
  ...over,
})

export const aTurn = (over: Partial<Turn> & { id: string }): Turn => ({
  stopReason: 'end_turn',
  toolCalls: [],
  plan: null,
  usage: null,
  endedAtMs: null,
  ...over,
})

/** A Subagent — a non-root node, so `parentId` defaults to the root's id. */
export const aSubagent = (over: Partial<Agent> & { id: string }): Agent => ({
  parentId: 'root',
  turns: [],
  compactions: [],
  ...over,
})

/** The Session's own node. `parentId === null` is what makes it the root. */
export const aRoot = (over: Partial<Agent> = {}): Agent => ({
  id: 'root',
  parentId: null,
  turns: [],
  compactions: [],
  ...over,
})

export const planEntries = (...statuses: PlanEntry['status'][]): PlanEntry[] =>
  statuses.map((status, index) => ({ text: `step ${index}`, status }))

/** A plan whose entries carry the prose an agent would actually write. `planEntries` above is for a
 * test that only cares about the arithmetic; anything a human LOOKS at wants this one, because
 * `step 0` renders as a surface that has never been judged. */
export const namedPlan = (entries: readonly [PlanEntry['status'], string][]): PlanEntry[] =>
  entries.map(([status, text]) => ({ text, status }))
