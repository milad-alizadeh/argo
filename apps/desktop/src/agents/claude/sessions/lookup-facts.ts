import type { ToolCall } from '../../../domains/sessions/contract/transcript'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

type LookupFacts = Pick<ToolCall, 'read' | 'search' | 'fetch'>

// Claude's file, search and web tools as the domain's `read`, `search` and `fetch` Tool Calls
// (CONTEXT.md L3 · Tool Call), keyed by tool name.
const LOOKUPS: Record<string, (input: Record<string, unknown>) => LookupFacts> = {
  Read: (input) => ({ read: { kind: 'read', target: text(input.file_path) } }),
  Glob: (input) => ({ search: { kind: 'search', scope: 'files', query: text(input.pattern) } }),
  Grep: (input) => ({ search: { kind: 'search', scope: 'files', query: text(input.pattern) } }),
  WebSearch: (input) => ({ search: { kind: 'search', scope: 'web', query: text(input.query) } }),
  WebFetch: (input) => ({ fetch: { kind: 'fetch', url: text(input.url) } }),
}

export function lookupFacts(name: string, input: Record<string, unknown>): LookupFacts {
  const read = Object.hasOwn(LOOKUPS, name) ? LOOKUPS[name] : undefined
  return read === undefined ? {} : read(input)
}
