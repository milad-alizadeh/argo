export type Quote = '"' | "'" | '`'

export const JAVASCRIPT_IDENTIFIER_SOURCE = '[A-Za-z_$][A-Za-z0-9_$]*'

export function openedQuote(character: string): Quote | null {
  return character === '"' || character === "'" || character === '`' ? character : null
}

export function nextQuotedState(
  character: string,
  quote: Quote,
  escaped: boolean,
): { quote: Quote | null; escaped: boolean } {
  if (escaped) return { quote, escaped: false }
  if (character === '\\') return { quote, escaped: true }
  return { quote: character === quote ? null : quote, escaped: false }
}
