// Parsing a git invocation's own words: what `git worktree add` names, and what branch a
// `git branch`/`switch`/`checkout` creates. No rules, no config — worktree-names.mts applies the
// convention to what this returns. Split from that file on length alone.
import { afterGitOptions, invocation } from './shell-commands.mts'

/**
 * The arguments of a git invocation, or null when the segment is not one. Only a segment that
 * *starts* with git is a command: `grep "git worktree add" docs/` is a mention, not a creation.
 */
export function gitArgs(tokens: string[]): string[] | null {
  const { name, args } = invocation(tokens)
  return name === 'git' ? afterGitOptions(args) : null
}

const branchFlag = (token: string): string | null =>
  (token.startsWith('-b') || token.startsWith('-B')) && token.length > 2 ? token.slice(2) : null

/** What a `git worktree add` names. Either half can be absent: the parse is of what is written. */
export type WorktreeAdd = { dir: string | undefined; branch: string | undefined }

/** Positional path and explicit branch of a `git worktree add`, or null. */
export function parseWorktreeAdd(args: string[]): WorktreeAdd | null {
  if (args[0] !== 'worktree' || args[1] !== 'add') return null
  let branch: string | undefined
  const positionals: string[] = []
  for (let i = 2; i < args.length; i += 1) {
    const token = args[i]
    if (token === undefined) continue
    if (token === '-b' || token === '-B') {
      i += 1
      branch = args[i]
    } else if (branchFlag(token)) branch = branchFlag(token) ?? undefined
    else if (!token.startsWith('-')) positionals.push(token)
  }
  return { dir: positionals[0], branch }
}

// The flag that names a NEW branch for the work in hand, per subcommand. `git branch -m` is the
// documented second half of entering a worktree; -c/-b reach the same end state by another road.
const BRANCH_FLAGS: Record<string, string[] | undefined> = {
  branch: ['-m', '-M', '--move'],
  switch: ['-c', '-C', '--create'],
  checkout: ['-b', '-B'],
}

/** New branch name a segment puts the current work on, or null. */
export function parseBranchCreate(args: string[]): string | null {
  const flags = BRANCH_FLAGS[args[0] ?? '']
  if (!flags) return null
  const rest = args.slice(1)
  const at = rest.findIndex((token) => flags.includes(token))
  if (at < 0) return null
  const names = rest.slice(at + 1).filter((token) => !token.startsWith('-'))
  // `git branch -m <old> <new>` renames a branch that is not the one in hand — never ours.
  if (args[0] === 'branch' && names.length > 1) return null
  return names[0] ?? null
}
