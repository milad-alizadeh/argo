import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { ComposerIdentity, WorktreeOptionsState } from '../composer'
import type { HarnessControl } from '../harness'

export function draftTarget({
  identity,
  harness,
  projectId,
  worktree,
}: {
  identity: ComposerIdentity
  harness: HarnessControl | null
  projectId: string | null
  worktree: Pick<WorktreeOptionsState, 'options' | 'newWorktree' | 'from'>
}): RouterInputs['composerDraftCreate']['target'] | null {
  if (identity.kind === 'session') return { type: 'session', sessionId: identity.sessionId }
  if (projectId === null || harness === null || worktree.options === null) return null
  return {
    type: 'project',
    projectId,
    worktree: worktree.newWorktree ? { type: 'new', from: worktree.from } : { type: 'main' },
    harness: harness.harness,
  }
}
