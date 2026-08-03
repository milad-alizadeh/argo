import type { GitFacts } from '../../shared'
import { readBranchRefs } from './branchRefs'
import { readHeadFacts } from './headFacts'
import { runGit } from './runGit'
import { attachWorktrees, readWorktrees } from './worktrees'

// The project's primary checkout as facts. `null` when the folder is not a git repository at
// all, which the shell renders by hiding the whole git group — git is optional for a Project
// (#165), not a gate, so a non-repo is a state to report rather than a failure.
export async function readGitFacts(repositoryPath: string): Promise<GitFacts | null> {
  if (!(await isGitRepository(repositoryPath))) return null

  const [head, refs, holders] = await Promise.all([
    readHeadFacts(repositoryPath),
    readBranchRefs(repositoryPath),
    readWorktrees(repositoryPath),
  ])
  return { ...head, branches: attachWorktrees(refs, holders) }
}

async function isGitRepository(repositoryPath: string): Promise<boolean> {
  const inside = await runGit(repositoryPath, ['rev-parse', '--is-inside-work-tree'])
  return inside.stdout.trim() === 'true'
}
