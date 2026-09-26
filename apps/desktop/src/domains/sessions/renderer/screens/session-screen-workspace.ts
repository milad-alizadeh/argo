import type { Session } from '../types'

export type ListedWorkspace = {
  id: string
  displayName: string
  facts: { branch: string | null }
}

export type SessionWorkspaceIdentity = {
  displayName: string
  branch: string | null
}

export function sessionWorkspaceIdentity(
  session: Pick<Session, 'workspaceId'> | null,
  workspaces: readonly ListedWorkspace[],
): SessionWorkspaceIdentity | null {
  if (session === null || session.workspaceId === null) return null
  const workspace = workspaces.find(({ id }) => id === session.workspaceId)
  return workspace === undefined
    ? null
    : { displayName: workspace.displayName, branch: workspace.facts.branch }
}
