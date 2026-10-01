import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { ComposerIdentity } from '../composer'
import type { WorktreeChoiceState } from '../composer/toolbar/use-worktree-choices'
import type { HarnessControl } from '../harness'

export function draftTarget({
  identity,
  harness,
  projectId,
  worktrees,
}: {
  identity: ComposerIdentity
  harness: HarnessControl
  projectId: string | null
  worktrees: WorktreeChoiceState
}): RouterInputs['composerDraftCreate']['target'] | null {
  if (identity.kind === 'session') return { type: 'session', sessionId: identity.sessionId }
  const { choice } = worktrees
  if (projectId === null || choice === null) return null
  const offered =
    choice === 'new' ||
    choice === 'main' ||
    worktrees.worktrees.some((candidate) => !candidate.main && candidate.path === choice)
  if (!offered) return null
  return { type: 'project', projectId, worktree: choice, harness: harness.harness }
}
