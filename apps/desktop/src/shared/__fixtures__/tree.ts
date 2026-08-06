import type {
  Agent,
  Compaction,
  DiffResult,
  MediaResult,
  OutputResult,
  Prose,
  ToolCall,
  Turn,
  Usage,
} from '../session/runtimeTree'

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
  contextTokens: null,
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

/** A one-pixel PNG, base64. Real bytes rather than a placeholder string, so a story renders a picture
 * and a `<img>` that will not decode is a failure of the code rather than of the fixture. */
export const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

/** The embedded tier by default — what the agent actually saw. Pass `tier: 'derived'` for the disk
 * fallback, and `bytes: null` for the image that cannot be shown at all. */
export const aMedia = (over: Partial<MediaResult> = {}): MediaResult => ({
  kind: 'media',
  tier: 'direct',
  mediaType: 'image/png',
  bytes: PIXEL_PNG,
  ...over,
})

/** A call that came back with pixels. A `read` by default, which is what a `Read` of a screenshot is;
 * an MCP browser tool lands on `other` and reads exactly the same. */
export const aShot = (over: Partial<ToolCall> & { id: string }): ToolCall => ({
  name: 'Read',
  kind: 'read',
  status: 'completed',
  target: 'tmp/shot.png',
  atMs: null,
  endedAtMs: null,
  usage: null,
  result: aMedia(),
  proseIndex: 0,
  ...over,
})

export const aUsage = (over: Partial<Usage> = {}): Usage => ({
  inputTokens: 120,
  outputTokens: 40,
  cacheReadTokens: 900,
  cacheCreationTokens: 30,
  ...over,
})
