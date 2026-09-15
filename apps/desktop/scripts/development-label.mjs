import { spawnSync } from 'node:child_process'
import path from 'node:path'

export function developmentBuildLabel(worktree, branch = null) {
  const ticket = branch?.match(/^argo\/#(\d+)(?:-|$)/)?.[1]
  if (ticket) return `#${ticket}`

  const worktreeTicket = path.basename(worktree).match(/^ticket-(\d+)(?:-|$)/)?.[1]
  if (worktreeTicket) return `#${worktreeTicket}`

  return branch?.replace(/^argo\//, '') || path.basename(worktree)
}

export function currentBranch(worktree) {
  const read = spawnSync('git', ['branch', '--show-current'], {
    cwd: worktree,
    encoding: 'utf8',
  })
  if (read.status !== 0) return null
  return read.stdout.trim() || null
}
