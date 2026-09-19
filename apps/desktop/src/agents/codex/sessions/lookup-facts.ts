import type { ToolCall } from '../../../domains/sessions/contract/transcript'

type Input = Record<string, unknown>
type LookupFacts = Pick<ToolCall, 'read' | 'search' | 'fetch'>

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const webSearch = (query: string | null): LookupFacts => ({
  search: { kind: 'search', scope: 'web', query },
})

// A search action carries `query`, and `queries` when the model fanned it out.
function searchQuery(input: Input): string | null {
  const [first] = Array.isArray(input.queries) ? input.queries : []
  return text(input.query) ?? text(first)
}

// The web actions of a rollout `web_search_call` item, keyed by `action.type`.
const WEB_SEARCH_ACTIONS: Record<string, (input: Input) => LookupFacts> = {
  search: (input) => webSearch(searchQuery(input)),
  open_page: (input) => ({ fetch: { kind: 'fetch', url: text(input.url) } }),
  find_in_page: (input) => webSearch(text(input.pattern)),
}

// Every Codex tool that reads, searches or fetches, keyed by its tool name. `web__run` is a
// fetch when it names a page and a search when it names a query.
const LOOKUPS: Record<string, (input: Input) => LookupFacts> = {
  web__run: (input) =>
    text(input.url) === null
      ? webSearch(searchQuery(input))
      : { fetch: { kind: 'fetch', url: text(input.url) } },
  'web.search': (input) => webSearch(searchQuery(input)),
  web_search_call: (input) => {
    const action = typeof input.type === 'string' ? input.type : ''
    const read = Object.hasOwn(WEB_SEARCH_ACTIONS, action) ? WEB_SEARCH_ACTIONS[action] : undefined
    return read === undefined ? {} : read(input)
  },
  view_image: (input) => ({ read: { kind: 'read', target: text(input.path) } }),
}

export function withLookupFacts(call: ToolCall): ToolCall {
  const read = Object.hasOwn(LOOKUPS, call.name) ? LOOKUPS[call.name] : undefined
  return read === undefined ? call : { ...call, ...read(call.input) }
}
