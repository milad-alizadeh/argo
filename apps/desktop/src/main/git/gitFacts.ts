import type { GitFacts } from '../../shared'
import { readBranchRefs } from './branchRefs'
import { readHeadFacts } from './headFacts'
import { runGit } from './runGit'
import { attachWorktrees, readWorktrees } from './worktrees'

// The project's primary checkout as facts. `null` when the folder is not a git repository at
// all, which the shell renders by hiding the whole git group — git is optional for a Project
// (#165), not a gate, so a non-repo is a state to report rather than a failure.
export async function readGitFacts(repoPath: string): Promise<GitFacts | null> {
  if (!(await isGitRepository(repoPath))) return null

  const [head, refs, holders] = await Promise.all([
    readHeadFacts(repoPath),
    readBranchRefs(repoPath),
    readWorktrees(repoPath),
  ])
  return { ...head, branches: attachWorktrees(refs, holders) }
}

async function isGitRepository(repoPath: string): Promise<boolean> {
  const inside = await runGit(repoPath, ['rev-parse', '--is-inside-work-tree'])
  return inside.stdout.trim() === 'true'
}
