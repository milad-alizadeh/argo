import type {
  FetchFacts,
  ReadFacts,
  SearchFacts,
} from '@/domains/sessions/contract/model'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

type LookupFacts = ReadFacts | SearchFacts | FetchFacts

// Claude's file, search and web tools as the domain's `read`, `search` and `fetch` Tool Calls
// (CONTEXT.md L3 · Tool Call), keyed by tool name.
const fileSearch = (input: Record<string, unknown>): LookupFacts => ({
  kind: 'search',
  scope: 'files',
  query: text(input.pattern),
})

const LOOKUPS: Record<string, (input: Record<string, unknown>) => LookupFacts> = {
  Read: (input) => ({ kind: 'read', target: text(input.file_path) }),
  Glob: fileSearch,
  Grep: fileSearch,
  WebSearch: (input) => ({ kind: 'search', scope: 'web', query: text(input.query) }),
  WebFetch: (input) => ({ kind: 'fetch', url: text(input.url) }),
}

export function lookupFacts(name: string, input: Record<string, unknown>): LookupFacts | null {
  const read = Object.hasOwn(LOOKUPS, name) ? LOOKUPS[name] : undefined
  return read === undefined ? null : read(input)
}
