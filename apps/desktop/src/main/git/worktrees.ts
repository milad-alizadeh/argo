import type { BranchRef } from '../../shared'
import { runGit } from './runGit'

const WORKTREE_ARGS = ['worktree', 'list', '--porcelain']

const WORKTREE_FIELD = 'worktree '
const BRANCH_FIELD = 'branch refs/heads/'

export async function readWorktrees(repositoryPath: string): Promise<Map<string, string>> {
  return parseWorktrees((await runGit(repositoryPath, WORKTREE_ARGS)).stdout)
}

// `git worktree list --porcelain` (grounded on git 2.50.1) emits one blank-line-separated record
// per worktree: `worktree <path>`, `HEAD <sha>`, then `branch refs/heads/<name>` — absent when
// that worktree is detached — and optional `bare` / `locked` / `prunable` markers. Keyed by
// branch because that is the question the menu asks: who is holding this one?
export function parseWorktrees(stdout: string): Map<string, string> {
  const holders = new Map<string, string>()
  let path = ''
  for (const line of stdout.split('\n')) {
    if (line.startsWith(WORKTREE_FIELD)) path = line.slice(WORKTREE_FIELD.length)
    if (line.startsWith(BRANCH_FIELD)) holders.set(line.slice(BRANCH_FIELD.length), path)
  }
  return holders
}

// The label follows git (spec §"Global git / checkout chrome"): every worktree-held branch
// carries its holder's path, so the menu can refuse a checkout git would refuse anyway. Remote
// ref names (`origin/main`) never match a local branch, so they are never held.
export function attachWorktrees(refs: BranchRef[], holders: Map<string, string>): BranchRef[] {
  return refs.map((ref) => ({ ...ref, worktreePath: holders.get(ref.name) ?? null }))
}
