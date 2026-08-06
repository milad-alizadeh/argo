// The primary checkout's git facts, as main observes them (ADR-0004: main runs git). Facts
// only — which rows a menu offers and what it refuses is derived on the renderer's side,
// so the shell's chrome and its menus can never disagree about the same branch.

/** One ref the branch menu can list: a local branch or an `origin` ref. */
export interface BranchRef {
  /** `main` for a local branch, `origin/main` for a remote ref. */
  name: string
  remote: boolean
  ahead: number
  behind: number
  /** The worktree holding this branch, read from `git worktree list`. */
  worktreePath: string | null
}

export interface GitFacts {
  /** The checked-out branch, or the short sha when HEAD is detached — the only honest
   * label git can give for a checkout that is on no branch. */
  branch: string
  ahead: number
  behind: number
  branches: BranchRef[]
}

/** Every operation the manage menu may offer. Safe by construction: nothing here can
 * lose work, which is why merging a diverged branch is absent (the shell offers an
 * escape hatch instead — Argo ships no merge-conflict editor). */
export const GIT_OPERATIONS = [
  'fetch',
  'pull',
  'push',
  'new-branch',
  'rename',
  'delete',
  'checkout',
] as const

export type GitOperation = (typeof GIT_OPERATIONS)[number]

export interface GitRequest {
  projectId: string
  operation: GitOperation
  /** The branch the operation acts on, for the operations that name one. */
  ref?: string
}
