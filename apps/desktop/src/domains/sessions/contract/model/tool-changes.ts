// What a web Tool Call fetched or searched, read off the facts its adapter filled.
import type { ToolCall, ToolResult } from './transcript'
import { resultText } from './transcript'

export function searchLabel(call: Extract<ToolCall, { kind: 'search' | 'fetch' }>) {
  if (call.kind === 'fetch') return `Fetched ${call.url ?? 'a page'}`
  return `Searched ${call.query ?? (call.scope === 'web' ? 'the web' : 'files')}`
}

// A web call's outcome is the first line of its output, which the Codex app shows beside the
// query. Codex writes no HTTP status: a fetch that failed says so in words instead.
const SEARCH_OUTCOMES = /^(Internal Error|Script error|Empty search results|Failed to fetch)/
export function searchOutcome(result: Pick<ToolResult, 'blocks'> | undefined): string | null {
  const source = result === undefined ? null : resultText(result.blocks)
  const outcome = source?.split('\n').find((line) => SEARCH_OUTCOMES.test(line)) ?? null
  return outcome === null ? null : outcome.replace(/\s*\(\)\s*$/, '')
}
