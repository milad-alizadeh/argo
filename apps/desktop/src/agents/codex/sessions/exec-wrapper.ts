import { isRecord } from '@/boundary'
import type { ToolCall } from '@/core/sessions/transcript'

type Quote = '"' | "'" | '`'

function quotedState(character: string | undefined, quote: Quote, escaped: boolean) {
  if (escaped) return { quote, escaped: false }
  if (character === '\\') return { quote, escaped: true }
  return { quote: character === quote ? null : quote, escaped: false }
}

function closingParenthesis(source: string, opening: number): number | null {
  let depth = 0
  let quote: Quote | null = null
  let escaped = false
  for (let index = opening; index < source.length; index += 1) {
    const character = source[index]
    if (quote !== null) {
      const next = quotedState(character, quote, escaped)
      quote = next.quote
      escaped = next.escaped
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }
    if (character === '(') depth += 1
    if (character === ')' && --depth === 0) return index
  }
  return null
}

function callInput(source: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(source)
    return isRecord(parsed) ? parsed : { input: source }
  } catch {
    // A wrapper can compute its argument. The source remains the honest fallback.
    return { input: source }
  }
}

export function nestedExecCalls(callId: string, source: string): ToolCall[] {
  const calls: ToolCall[] = []
  const pattern = /tools\.([A-Za-z0-9_]+)\s*\(/g
  for (const match of source.matchAll(pattern)) {
    const name = match[1]
    const opening = (match.index ?? 0) + match[0].length - 1
    const closing = closingParenthesis(source, opening)
    if (name === undefined || closing === null) continue
    const argument = source.slice(opening + 1, closing).trim()
    calls.push({ id: `${callId}:${calls.length}`, name, input: callInput(argument) })
  }
  return calls
}
