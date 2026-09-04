// Which files a shell command line writes. Read by worktree-guard.mjs, which decides what to do
// about them; this file only reads the command and answers with paths, so both halves stay
// testable on their own (shell-writes.test.mjs, worktree-guard.test.mjs).
//
// It reads what the shell can NAME. A program that writes as a side effect (`swift build`,
// `bun install`) names no path and is not read here: this is about an agent authoring content,
// not about every byte a build touches. Nor does it expand anything — a token still holding a
// `$` or a backtick comes back as it is, and the caller decides (the guards allow it, because
// guessing at an expansion would deny work that may well be correct).
import path from 'node:path'

// Commands that write a file the shell can name. `dd` and `apply_patch` are handled below —
// one names its target with `of=`, the other carries every path inside a heredoc body.
const WRITE_COMMANDS = {
  // Every positional is a target.
  all: ['rm', 'rmdir', 'touch', 'truncate', 'tee', 'patch'],
  // The last positional is the destination; the earlier ones are sources being read.
  last: ['cp', 'mv', 'ln', 'install'],
}
// In-place editors: the flag turns a filter into a writer, so the paths only count with it.
const IN_PLACE = { sed: ['-i'], perl: ['-i'], ruby: ['-i'], gsed: ['-i'] }

// A leading `VAR=value` is the shell's env prefix, not the command. `of=x` is not one of these:
// it follows the command word, which this loop has already stopped at.
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

/**
 * The current directory itself, returned for an editor that names its paths somewhere this
 * parser cannot read them. `apply_patch` carries every path inside its heredoc body.
 */
export const CURRENT_DIRECTORY = '.'

// Split on shell separators so `cd x && cat > y` is seen. A heredoc body is data the shell
// never runs, so everything after the opener is dropped — the redirection that matters
// (`> file <<EOF`) is always in front of it.
const segments = (command) => command.split('<<')[0].split(/&&|\|\||;|\||\n/)
const tokenize = (segment) =>
  segment
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[('"]+|[)'"]+$/g, ''))
    .filter(Boolean)

/** Strip the leading `rtk`, `sudo` and `VAR=value` noise to reach the real command. */
function commandTokens(tokens) {
  let i = 0
  const noise = (token) =>
    token === 'rtk' || token === 'sudo' || token === 'env' || ENV_ASSIGNMENT.test(token)
  while (i < tokens.length && noise(tokens[i])) i += 1
  return tokens.slice(i)
}

/**
 * Redirection targets in one segment: `> file`, `>> file`, `3> file`. Not `2>&1` or `>&2`,
 * which duplicate a descriptor and name no file.
 */
function redirectTargets(segment) {
  const targets = []
  const re = /(?:^|\s)\d*>>?\s*([^\s&|;]+)/g
  let match = re.exec(segment)
  while (match) {
    // Quotes are the shell's, not part of the name: `> "out file"` writes `out file`.
    targets.push(match[1].replace(/^['"]+|['"]+$/g, ''))
    match = re.exec(segment)
  }
  return targets
}

/** Paths one command writes, ignoring its options. */
function commandTargets(tokens) {
  const [name, ...rest] = tokens
  if (!name) return []
  const bare = path.basename(name)
  const positionals = rest.filter((token) => !token.startsWith('-'))

  if (bare === 'dd') {
    return rest.filter((token) => token.startsWith('of=')).map((token) => token.slice(3))
  }
  if (bare === 'apply_patch') return [CURRENT_DIRECTORY]
  if (IN_PLACE[bare]) {
    const inPlace = rest.some((token) => IN_PLACE[bare].some((flag) => token.startsWith(flag)))
    // `sed -i '' -e expr file`: the expression is a positional too, and it is not a path. Only
    // the tail can be, so the first positional goes when it is the script.
    return inPlace ? positionals.slice(1) : []
  }
  if (WRITE_COMMANDS.all.includes(bare)) return positionals
  if (WRITE_COMMANDS.last.includes(bare)) return positionals.slice(-1)
  return []
}

/**
 * Every path a command line writes, unexpanded and unresolved, in the order they appear.
 * @param {string} command
 * @returns {string[]}
 */
export function writeTargets(command) {
  const targets = []
  for (const segment of segments(command)) {
    targets.push(...redirectTargets(segment), ...commandTargets(commandTokens(tokenize(segment))))
  }
  return targets
}
