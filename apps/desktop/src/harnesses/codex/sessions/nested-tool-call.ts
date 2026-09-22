import { nextQuotedState, openedQuote, type Quote } from './javascript-string'

// Any `tools.<name>(` the script reaches as code: assigned, awaited inline, or inside a callback.
const TOOL_CALL = /tools\.([A-Za-z][A-Za-z0-9_]*)\s*\(/y

// Every index of the script that is code: not inside a string, and not inside a line comment.
function* codeIndexes(input: string, start = 0): Generator<number> {
  let quote: Quote | null = null
  let escaped = false
  for (let index = start; index < input.length; index += 1) {
    const character = input.charAt(index)
    if (quote !== null) {
      const nextState = nextQuotedState(character, quote, escaped)
      quote = nextState.quote
      escaped = nextState.escaped
      continue
    }
    quote = openedQuote(character)
    if (quote !== null) continue
    if (input.startsWith('//', index)) {
      const lineEnd = input.indexOf('\n', index)
      if (lineEnd === -1) return
      index = lineEnd
      continue
    }
    yield index
  }
}

function spanUntilClose(input: string, start: number, [open, close]: readonly [string, string]) {
  let depth = 1
  for (const index of codeIndexes(input, start)) {
    const character = input.charAt(index)
    if (character === open) depth += 1
    if (character === close) {
      depth -= 1
      if (depth === 0) return input.slice(start, index)
    }
  }
  return null
}

function argumentsUntilClose(input: string, start: number): string | null {
  return spanUntilClose(input, start, ['(', ')'])
}

// The first match of a sticky pattern that starts in code rather than inside a string.
export function codeMatch(input: string, pattern: RegExp): RegExpExecArray | null {
  for (const index of codeIndexes(input)) {
    pattern.lastIndex = index
    const match = pattern.exec(input)
    if (match !== null) return match
  }
  return null
}

// The array literal a script assigns to `name` before passing the variable to a tool, as in
// `const plan = [...]; await tools.update_plan({plan})`.
export function arrayAssignedTo(input: string, name: string): string | null {
  const assignment = codeMatch(input, new RegExp(`(?<![A-Za-z0-9_$.])${name}\\s*=\\s*\\[`, 'y'))
  if (assignment === null) return null
  const body = spanUntilClose(input, assignment.index + assignment[0].length, ['[', ']'])
  return body === null ? null : `[${body}]`
}

export function nestedToolCall(input: string): { name: string; argumentsText: string } | null {
  return nestedToolCalls(input)[0] ?? null
}

export function nestedToolCalls(input: string): { name: string; argumentsText: string }[] {
  const calls: { name: string; argumentsText: string }[] = []
  let resumeAt = 0
  for (const index of codeIndexes(input)) {
    if (index < resumeAt) continue
    TOOL_CALL.lastIndex = index
    const name = TOOL_CALL.exec(input)?.[1]
    if (name === undefined) continue
    const start = TOOL_CALL.lastIndex
    const argumentsText = argumentsUntilClose(input, start)
    if (argumentsText === null) break
    calls.push({ name, argumentsText })
    resumeAt = start + argumentsText.length
  }
  return calls
}
