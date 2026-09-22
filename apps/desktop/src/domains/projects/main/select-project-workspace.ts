import { type ProjectError, projectError } from '@/domains/projects/contract/contract'
import type {
  ProjectWorkspaceListed,
  ProjectWorkspaceSelectRequest,
} from '@/domains/projects/contract/workspace-messages'
import { listProjectWorkspaces, relistRequest } from './list-project-workspaces'
import type { ProjectStore } from './register-project'

export async function selectProjectWorkspace(
  request: ProjectWorkspaceSelectRequest,
  store: Pick<ProjectStore, 'projects'>,
): Promise<ProjectWorkspaceListed | ProjectError> {
  try {
    store.projects.selectWorkspace(request.projectId, request.workspaceId)
  } catch {
    return projectError('missing-workspace', request.requestId)
  }
  return listProjectWorkspaces(relistRequest(request.projectId, request.requestId), store)
}
