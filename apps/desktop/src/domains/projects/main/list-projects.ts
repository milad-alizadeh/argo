// Restoring the cockpit on launch: the known set and the Project that was open when it last closed.
import { projectError } from '../contract/contract'
import type { ProjectListReply, ProjectListRequest } from '../contract/messages'
import { listed } from './presentation'
import type { ProjectStore } from './register-project'

export async function listProjects(
  request: ProjectListRequest,
  store: ProjectStore,
): Promise<ProjectListReply> {
  try {
    return listed(request.requestId, store.projects.read())
  } catch {
    return projectError('storage-unavailable', request.requestId)
  }
}
