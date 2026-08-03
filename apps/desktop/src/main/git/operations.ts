import type { CommandResult, GitOperation, GitRequest } from '../../shared'
import { runGit } from './runGit'

// The operations that act on a named branch rather than on HEAD's own tracking relationship.
const REF_OPERATIONS: GitOperation[] = ['new-branch', 'rename', 'delete', 'checkout']

export async function runGitOperation(
  repoPath: string,
  request: GitRequest,
): Promise<CommandResult> {
  const ref = request.ref ?? ''
  if (ref === '' && REF_OPERATIONS.includes(request.operation)) {
    return { ok: false, detail: `${request.operation} names no branch` }
  }

  const output = await runGit(repoPath, argumentsFor(request.operation, ref))
  return { ok: output.ok, detail: output.stderr.trim() || output.stdout.trim() }
}

// Each operation's argv. Safe by construction, matching the vocabulary in `shared/git.ts`: no
// merge, no rebase, no force, no reset, no worktree removal. `--ff-only` and `branch --delete`
// (never `-D`) hand the refusal to git itself, which is the one judge that cannot be wrong
// about whether work is at risk.
function argumentsFor(operation: GitOperation, ref: string): string[] {
  switch (operation) {
    case 'fetch':
      // Pruning is what makes a deleted upstream read as `[gone]` instead of lingering as a
      // remote ref the menu would still offer.
      return ['fetch', '--prune']
    case 'pull':
      return ['pull', '--ff-only']
    case 'push':
      return ['push']
    case 'new-branch':
      return ['checkout', '-b', ref]
    // `GitRequest` carries one ref, so a rename can only mean "rename the checked-out branch
    // to this name" — the shell offers it from the branch the bar is already showing.
    case 'rename':
      return ['branch', '--move', ref]
    case 'delete':
      return ['branch', '--delete', ref]
    // Passed through verbatim: `checkout main` starts tracking `origin/main`, `checkout
    // origin/main` detaches, and which of those the user asked for is the renderer's to name.
    case 'checkout':
      return ['checkout', ref]
    default: {
      const unhandled: never = operation
      throw new Error(`Unhandled git operation: ${String(unhandled)}`)
    }
  }
}
