import type { ProjectError } from '@/domains/projects/contract/contract'
import type {
  ProjectWorkspaceListed,
  ProjectWorkspaceListRequest,
} from '@/domains/projects/contract/workspace-messages'
import { readWorkspaceFacts } from '@/domains/projects/main/workspaces/workspace-facts'
import { reconcileWorkspaces } from '@/domains/projects/main/workspaces/workspace-reconciliation'
import { findProject, type ProjectStore } from './register-project'

export function relistRequest(projectId: string, requestId: string): ProjectWorkspaceListRequest {
  return { version: 1, type: 'project.workspace.list', requestId, projectId }
}

export async function listProjectWorkspaces(
  request: ProjectWorkspaceListRequest,
  store: Pick<ProjectStore, 'projects'>,
): Promise<ProjectWorkspaceListed | ProjectError> {
  const project = findProject(store, request.projectId, request.requestId)
  if ('code' in project) return project
  const workspaces = await reconcileWorkspaces(store.projects, project)
  const summaries = await Promise.all(
    workspaces.map(async (workspace) => ({
      id: workspace.id,
      kind: workspace.kind,
      displayName: workspace.displayName,
      path: workspace.path,
      facts: await readWorkspaceFacts(workspace.path),
    })),
  )
  return {
    version: 1,
    type: 'project.workspace.listed',
    requestId: request.requestId,
    workspaces: summaries,
    selectedId: store.projects.readWorkspaceSelection(project.id),
  }
}
