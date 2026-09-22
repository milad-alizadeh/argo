// The facts git owns about a checkout, read live and never persisted: a Workspace's identity does
// not move when its branch does (CONTEXT.md · Project). One shell-out per fact keeps a missing
// directory or a detached HEAD a plain failure rather than a parse error.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export type WorkspaceFacts = { branch: string | null; headSha: string | null; dirty: boolean }

const UNREADABLE_FACTS: WorkspaceFacts = { branch: null, headSha: null, dirty: false }

export async function readWorkspaceFacts(checkoutPath: string): Promise<WorkspaceFacts> {
  try {
    const [branch, head, status] = await Promise.all([
      run('git', ['-C', checkoutPath, 'rev-parse', '--abbrev-ref', 'HEAD']),
      run('git', ['-C', checkoutPath, 'rev-parse', 'HEAD']),
      run('git', ['-C', checkoutPath, 'status', '--porcelain']),
    ])
    const branchName = branch.stdout.trim()
    return {
      // A detached HEAD reports its own name as the branch; that is not a branch.
      branch: branchName === '' || branchName === 'HEAD' ? null : branchName,
      headSha: head.stdout.trim() || null,
      dirty: status.stdout.trim() !== '',
    }
  } catch {
    return UNREADABLE_FACTS
  }
}
