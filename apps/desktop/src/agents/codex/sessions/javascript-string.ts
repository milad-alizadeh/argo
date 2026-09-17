export type Quote = '"' | "'" | '`'

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
