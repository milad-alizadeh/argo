import { type ProjectError, projectError } from '@/domains/projects/contract/contract'
import type {
  ProjectWorkspaceCreateManagedRequest,
  ProjectWorkspaceListed,
} from '@/domains/projects/contract/workspace-messages'
import { listProjectWorkspaces, relistRequest } from './list-project-workspaces'
import { findProject, type ProjectStore } from './register-project'
import { createManagedWorkspace } from './workspaces/create-managed-workspace'

export async function createManagedProjectWorkspace(
  request: ProjectWorkspaceCreateManagedRequest,
  store: Pick<ProjectStore, 'projects'>,
): Promise<ProjectWorkspaceListed | ProjectError> {
  const project = findProject(store, request.projectId, request.requestId)
  if ('code' in project) return project
  try {
    await createManagedWorkspace(store.projects, project, request.baseRef)
  } catch {
    return projectError('git-unavailable', request.requestId)
  }
  return listProjectWorkspaces(relistRequest(request.projectId, request.requestId), store)
}
