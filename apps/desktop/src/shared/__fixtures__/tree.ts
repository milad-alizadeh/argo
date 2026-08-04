import type {
  Agent,
  Compaction,
  DiffResult,
  OutputResult,
  Prose,
  ToolCall,
  Turn,
  Usage,
} from '../runtimeTree'

// Builders for the locked runtime tree, shared by the feed derivation's tests. One home for the
// shape, so a field added to `ToolCall` is a compile error in one place rather than in every test
// that happened to spell the whole object out.

export const aTurn = (over: Partial<Turn> & { id: string }): Turn => ({
  stopReason: 'end_turn',
  prompt: null,
  prose: [],
  toolCalls: [],
  plan: null,
  usage: null,
  startedAtMs: null,
  endedAtMs: null,
  ...over,
})

export const anAgent = (turns: Turn[], compactions: Compaction[] = []): Agent => ({
  id: 'root',
  parentId: null,
  turns,
  compactions,
  startedAtMs: null,
  endedAtMs: null,
  usage: null,
})

export const said = (markdown: string): Prose => ({ kind: 'message', markdown })
export const thought = (markdown: string): Prose => ({ kind: 'thought', markdown })

export const aDiff = (over: Partial<DiffResult> = {}): DiffResult => ({
  kind: 'diff',
  tier: 'direct',
  change: 'modify',
  added: 41,
  removed: 1,
  hunks: [{ oldStart: 1, newStart: 1, lines: [{ side: 'add', text: 'new' }] }],
  ...over,
})

export const anEdit = (over: Partial<ToolCall> & { id: string }): ToolCall => ({
  name: 'Edit',
  kind: 'edit',
  status: 'completed',
  target: 'src/token.ts',
  atMs: null,
  endedAtMs: null,
  usage: null,
  result: aDiff(),
  proseIndex: 0,
  ...over,
})

/** A call of any other kind, defaulting to the quietest one there is: a completed read. */
export const aCall = (over: Partial<ToolCall> & { id: string }): ToolCall => ({
  name: 'Read',
  kind: 'read',
  status: 'completed',
  target: 'src/token.ts',
  atMs: null,
  endedAtMs: null,
  usage: null,
  result: null,
  proseIndex: 0,
  ...over,
})

export const anOutput = (text: string): OutputResult => ({ kind: 'output', tier: 'direct', text })

export const aUsage = (over: Partial<Usage> = {}): Usage => ({
  inputTokens: 120,
  outputTokens: 40,
  cacheReadTokens: 900,
  cacheCreationTokens: 30,
  ...over,
})
