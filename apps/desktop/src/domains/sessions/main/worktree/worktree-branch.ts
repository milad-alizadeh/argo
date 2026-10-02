import { runGit } from './worktree-folder'

// The branch a checkout is on, or null when it is detached or git cannot read it.
export async function readWorktreeBranch(checkoutPath: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(['-C', checkoutPath, 'rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = stdout.trim()
    return branch === '' || branch === 'HEAD' ? null : branch
  } catch {
    return null
  }
}
