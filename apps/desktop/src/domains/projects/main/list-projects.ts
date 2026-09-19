// Restoring the cockpit on launch: the known set and the Project that was open when it last closed.
import { projectError } from '@/domains/projects/contract/contract'
import type { ProjectListReply, ProjectListRequest } from '@/domains/projects/contract/messages'
import { listed } from '@/domains/projects/main/presentation'
import type { ProjectStore } from '@/domains/projects/main/register-project'

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
