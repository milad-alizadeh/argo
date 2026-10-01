import type { WorkspaceState } from '@/domains/workspaces/renderer'
import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { ComposerIdentity } from '../composer'
import type { HarnessControl } from '../harness'

export function draftTarget({
  identity,
  harness,
  projectId,
  workspace,
}: {
  identity: ComposerIdentity
  harness: HarnessControl
  projectId: string | null
  workspace: WorkspaceState
}): RouterInputs['composerDraftCreate']['target'] | null {
  if (identity.kind === 'session') return { type: 'session', sessionId: identity.sessionId }
  if (projectId === null || workspace.choice === null) return null
  let workspaceId: string | null
  if (workspace.choice === 'new') workspaceId = null
  else if (workspace.workspace?.id === workspace.choice) workspaceId = workspace.choice
  else return null
  return {
    type: 'project',
    projectId,
    workspaceId,
    harness: harness.harness,
  }
}
