// Restoring the cockpit on launch: the known set and the Project that was open when it last closed.
import { projectError } from './contract'
import { isProjectListRequest, type ProjectListReply } from './messages'
import { openRegistry } from './register-project'
import { listed, readRegistry } from './registry'

export async function listProjects(
  value: unknown,
  registryPath: string,
): Promise<ProjectListReply> {
  if (!isProjectListRequest(value)) return projectError('invalid-request', null)
  const registry = openRegistry(await readRegistry(registryPath))
  if (typeof registry === 'string') return projectError(registry, value.requestId)
  return listed(value.requestId, registry)
}
