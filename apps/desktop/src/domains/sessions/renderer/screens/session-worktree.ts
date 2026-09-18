const WORKTREE_DIRECTORY = '/.claude/worktrees/'

export function worktreeName(cwd: string | null): string | null {
  if (cwd === null) return null
  const directory = cwd.split(WORKTREE_DIRECTORY)[1]
  return directory?.split('/')[0] || null
}
