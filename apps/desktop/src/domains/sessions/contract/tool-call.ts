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

// A skill the agent loaded: `title` is the reader-facing name. The body arrives as a later record.
export type SkillFacts = { kind: 'skill'; title: string | null }

// A tool no other kind holds. `label` is what the row says, the harness name when nothing better
// is known. `source` says where the call went, for example an MCP server: a fact, never a kind.
export type OtherFacts = {
  kind: 'other'
  label: string
  source: { server: string; tool: string } | null
}

// One file an edit touched. `diff` is the typed diff Result: the change is known from the call
// itself, so it is ready before the harness answers.
export type EditedFile = {
  change: 'create' | 'update' | 'delete'
  file: string | null
  diff: string
  lineCounts: { added: number; removed: number }
}

// A file change. A harness that writes one call for several files fills one entry per file, and
// the Feed draws one row for each.
export type EditFacts = { kind: 'edit'; files: EditedFile[] }

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
  skill?: SkillFacts
  other?: OtherFacts
  edit?: EditFacts
}
