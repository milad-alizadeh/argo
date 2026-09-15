const wordsOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

// A skill body that opens on a heading repeating the skill's name drops it: the row already says it.
export function withoutRepeatedTitle(text: string, label: string) {
  const heading = /^\s*#{1,6}\s+(.+?)\s*#*\s*(?:\n|$)/.exec(text)
  if (heading?.[1] === undefined || wordsOf(heading[1]) !== wordsOf(label)) return text
  return text.slice(heading[0].length).trimStart()
}
