// Reading a Bash tool call as a list of invocations, shared by the guards that judge one.
//
// It is deliberately shallow and deliberately not a shell parser. Every consumer here asks the
// same narrow question — "does this command line RUN <program>, and with what arguments" — and
// the answer only has to be right about the shapes an agent actually writes. A real parser
// would be more correct and would still need every caller to decide what to do about `$VAR`,
// which is the part that matters: see `unexpanded`.
//
// Pure string logic, no fs and no spawning.

/**
 * A command line split into the segments a shell would run as separate commands, so
 * `cd x && git worktree add …` is seen as two.
 *
 * Anything after a heredoc opener is dropped: its body is data the shell never runs, and eight
 * tracked files in this repo quote a guarded command inside one. Treating a quoted mention as an
 * invocation denies any session searching or rewriting the docs that describe the rule.
 */
export const segments = (command) => command.split('<<')[0].split(/&&|\|\||;|\||\n/)

/**
 * A segment's tokens. Quotes and subshell parens are stripped because everything read through
 * here is a path, a branch name or a subcommand.
 */
export const tokenize = (segment) =>
  segment
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[('"]+|[)'"]+$/g, ''))
    .filter(Boolean)

/**
 * True for a token this file cannot resolve. Guessing at an expansion is how a guard denies
 * correct work, so every caller treats an unexpanded token as "no opinion" rather than as a
 * match or a miss.
 */
export const unexpanded = (token) => token.includes('$') || token.includes('`')

/**
 * The invocation a segment's tokens describe: the launcher and environment-assignment prefix in
 * front of it, the program name, and its arguments.
 *
 * The prefix is returned rather than skipped over because it carries meaning of its own: an
 * `rtk` wrapper is noise, but `FOO=1 cmd` is how a caller marks a command for a guard reading it.
 *
 * @param {string[]} tokens
 * @returns {{ prefix: string[], name: string | undefined, args: string[] }}
 */
export function invocation(tokens) {
  let i = 0
  while (i < tokens.length && (tokens[i] === 'rtk' || tokens[i].includes('='))) i += 1
  return { prefix: tokens.slice(0, i), name: tokens[i], args: tokens.slice(i + 1) }
}

/**
 * `git`'s own options precede its subcommand (`git -C <dir> push`, `git --git-dir=… push`), so
 * the subcommand is not simply the first argument.
 * @param {string[]} args arguments as `invocation()` returned them
 * @returns {string[]} from the subcommand onwards
 */
export function afterGitOptions(args) {
  let i = 0
  while (i < args.length && args[i].startsWith('-')) i += args[i] === '-C' ? 2 : 1
  return args.slice(i)
}
