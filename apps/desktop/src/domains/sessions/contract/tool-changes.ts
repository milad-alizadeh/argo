// What a Tool Call changed or fetched, read off its own input: an Edit or Write carries its
// change, an apply_patch its patch, and a web call its query or page.
import { readPatch } from './apply-patch'
import type { ToolCall, ToolResult } from './transcript'
import { resultText } from './transcript'
import { createdPatch, unifiedPatch } from './unified-patch'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const lineCount = (text: string) => text.split('\n').length

export function patchOf(call: ToolCall) {
  const patch = text(call.input.patch)
  return patch === null ? null : readPatch(patch)
}

// An Edit or a Write carries its change in its own input, so its diff is ready before the result.
export function fileChange(call: ToolCall) {
  const { old_string: oldText, new_string: newText, content } = call.input
  if (call.name === 'Edit' && typeof oldText === 'string' && typeof newText === 'string') {
    return {
      patch: unifiedPatch(oldText, newText),
      lineCounts: { added: lineCount(newText), removed: lineCount(oldText) },
    }
  }
  if (call.name === 'Write' && typeof content === 'string') {
    return { patch: createdPatch(content), lineCounts: { added: lineCount(content), removed: 0 } }
  }
  const change = call.name === 'apply_patch' ? patchOf(call) : null
  return change === null ? null : { patch: change.diff, lineCounts: change.lineCounts }
}

export function searchLabel({ search, fetch }: ToolCall) {
  if (fetch !== undefined) return `Fetched ${fetch.url ?? 'a page'}`
  if (search === undefined) return 'Searched'
  return `Searched ${search.query ?? (search.scope === 'web' ? 'the web' : 'files')}`
}

// A web call's outcome is the first line of its output, which the Codex app shows beside the
// query. Codex writes no HTTP status: a fetch that failed says so in words instead.
const SEARCH_OUTCOMES = /^(Internal Error|Script error|Empty search results|Failed to fetch)/
export function searchOutcome(result: Pick<ToolResult, 'blocks'> | undefined): string | null {
  const source = result === undefined ? null : resultText(result.blocks)
  const outcome = source?.split('\n').find((line) => SEARCH_OUTCOMES.test(line)) ?? null
  return outcome === null ? null : outcome.replace(/\s*\(\)\s*$/, '')
}
