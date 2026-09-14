// Restoring the cockpit on launch: the known set and the Project that was open when it last closed.
import { projectError } from './contract'
import type { ProjectListReply, ProjectListRequest } from './messages'
import { openRegistry } from './register-project'
import { listed, readRegistry } from './registry'

export async function listProjects(
  request: ProjectListRequest,
  registryPath: string,
): Promise<ProjectListReply> {
  const registry = openRegistry(await readRegistry(registryPath))
  if (typeof registry === 'string') return projectError(registry, request.requestId)
  return listed(request.requestId, registry)
}
