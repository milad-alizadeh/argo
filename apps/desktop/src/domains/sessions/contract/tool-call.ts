// Where a Tool Call stands (CONTEXT.md L3 · Tool Call). A call the person declines on Codex is
// `failed` with the reason as its text; a call stopped before it finished is `interrupted`.
export const TOOL_CALL_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'interrupted',
] as const
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number]

// What a harness adapter fills for a command, so shared code reads the kind and never a harness
// tool name. `command` is the first line that ran, `label` the words the agent gave the call.
export type ExecuteFacts = {
  kind: 'execute'
  command: string | null
  label: string | null
  // The full text the row shows beside its label.
  text: string | null
  background: boolean
}

// A file read: `target` is the file, or the image an agent looked at.
export type ReadFacts = { kind: 'read'; target: string | null }

// A search: `query` is the pattern or the words searched, in the scope it ran over.
export type SearchFacts = { kind: 'search'; scope: 'files' | 'web'; query: string | null }

// A web page read.
export type FetchFacts = { kind: 'fetch'; url: string | null }

// The new shape lives beside the raw one: a call an adapter classified carries its kind's facts,
// and every other kind still reads `name` and `input`.
export type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
  execute?: ExecuteFacts
  read?: ReadFacts
  search?: SearchFacts
  fetch?: FetchFacts
}
