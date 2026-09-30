// Joins a rollout's argument list the way `thread/read` writes one command string: the Rust `shlex`
// crate's `try_join`, which quotes each word in the fewest chunks that stay literal in every shell.
const UNQUOTED = /^[+\-./:@\]_0-9A-Za-z]$/
const NOT_SINGLE_QUOTED = new Set(["'", '^', '\\'])
const NOT_DOUBLE_QUOTED = new Set(['`', '$', '!', '^'])

type Quoting = 'unquoted' | 'single' | 'double'

const UNQUOTED_OK = 1
const SINGLE_QUOTED_OK = 2
const DOUBLE_QUOTED_OK = 4

// The longest prefix one quoting keeps literal, and the best quoting for it.
function quotedChunk(word: string): { length: number; quoting: Quoting } {
  let allowed = UNQUOTED_OK | SINGLE_QUOTED_OK | DOUBLE_QUOTED_OK
  let index = 0
  // A leading caret is only safe right after an opening single quote.
  if (word.startsWith('^')) {
    allowed = SINGLE_QUOTED_OK
    index = 1
  }
  for (; index < word.length; index += 1) {
    const character = word[index] ?? ''
    let current = allowed
    if (character.charCodeAt(0) >= 0x80 || !UNQUOTED.test(character)) current &= ~UNQUOTED_OK
    if (NOT_SINGLE_QUOTED.has(character)) current &= ~SINGLE_QUOTED_OK
    if (NOT_DOUBLE_QUOTED.has(character)) current &= ~DOUBLE_QUOTED_OK
    if (current === 0) break
    allowed = current
  }
  if (allowed & UNQUOTED_OK) return { length: index, quoting: 'unquoted' }
  if (allowed & SINGLE_QUOTED_OK) return { length: index, quoting: 'single' }
  return { length: index, quoting: 'double' }
}

function quotedWord(word: string): string {
  if (word === '') return "''"
  let quoted = ''
  let rest = word
  while (rest !== '') {
    const { length, quoting } = quotedChunk(rest)
    const chunk = rest.slice(0, length)
    rest = rest.slice(length)
    const chunkQuoting = {
      unquoted: () => chunk,
      single: () => `'${chunk}'`,
      double: () => `"${chunk.replace(/["\\]/g, '\\$&')}"`,
    } as const satisfies Record<Quoting, () => string>
    quoted += chunkQuoting[quoting]()
  }
  return quoted
}

export function codexShellCommand(words: readonly string[]): string {
  return words.map(quotedWord).join(' ')
}
