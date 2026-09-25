import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export async function readWorkspaceFacts(checkoutPath: string) {
  try {
    const [branch, head, status] = await Promise.all([
      run('git', ['-C', checkoutPath, 'rev-parse', '--abbrev-ref', 'HEAD']),
      run('git', ['-C', checkoutPath, 'rev-parse', 'HEAD']),
      run('git', ['-C', checkoutPath, 'status', '--porcelain']),
    ])
    const branchName = branch.stdout.trim()
    return {
      branch: branchName === '' || branchName === 'HEAD' ? null : branchName,
      headSha: head.stdout.trim() || null,
      dirty: status.stdout.trim() !== '',
    }
  } catch {
    return { branch: null, headSha: null, dirty: false }
  }
}
