import {
  JAVASCRIPT_IDENTIFIER_SOURCE,
  nextQuotedState,
  openedQuote,
  type Quote,
} from './javascript-string'

const TOOL_WRAPPER = new RegExp(
  `^\\s*const\\s+${JAVASCRIPT_IDENTIFIER_SOURCE}\\s*=\\s*await\\s+tools\\.([A-Za-z][A-Za-z0-9_]*)\\s*\\(`,
)

function argumentsUntilClose(input: string, start: number): string | null {
  let depth = 1
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
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth === 0) return input.slice(start, index)
    }
  }
  return null
}

export function nestedToolCall(input: string): { name: string; argumentsText: string } | null {
  const match = TOOL_WRAPPER.exec(input)
  const name = match?.[1]
  if (match === null || name === undefined) return null
  const argumentsText = argumentsUntilClose(input, match[0].length)
  return argumentsText === null ? null : { name, argumentsText }
}
