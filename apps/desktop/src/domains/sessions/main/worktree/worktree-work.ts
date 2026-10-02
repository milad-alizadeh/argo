import { runGit } from './worktree-folder'

// What removing a worktree would delete. A count git could not read is null, and is never clean.
export type WorktreeWork = {
  // Changed or untracked files, including uncommitted work inside checked-out submodules.
  changedFiles: number | null
  // Commits on no other local branch and no remote-tracking ref.
  ownCommits: number | null
}

function count(arguments_: string[], parse: (stdout: string) => number): Promise<number | null> {
  return runGit(arguments_).then(
    ({ stdout }) => parse(stdout),
    () => null,
  )
}

export function readWorktreeWork(folder: string, branch: string | null): Promise<WorktreeWork> {
  const others = branch === null ? [] : [`--exclude=${branch}`]
  return Promise.all([
    count(
      ['-C', folder, 'status', '--porcelain', '--ignore-submodules=none'],
      (stdout) => stdout.split('\n').filter((line) => line !== '').length,
    ),
    count(
      ['-C', folder, 'rev-list', '--count', 'HEAD', '--not', ...others, '--branches', '--remotes'],
      (stdout) => Number.parseInt(stdout.trim(), 10),
    ),
  ]).then(([changedFiles, ownCommits]) => ({
    changedFiles,
    ownCommits: Number.isNaN(ownCommits) ? null : ownCommits,
  }))
}

export function isClean(work: WorktreeWork): boolean {
  return work.changedFiles === 0 && work.ownCommits === 0
}
