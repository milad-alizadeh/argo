// Restoring the cockpit on launch: the known set and the Project that was open when it last closed.
import { projectError } from './contract'
import { projectListRequestSchema, type ProjectListReply } from './messages'
import { openRegistry } from './register-project'
import { listed, readRegistry } from './registry'

export async function listProjects(
  value: unknown,
  registryPath: string,
): Promise<ProjectListReply> {
  const parsed = projectListRequestSchema.safeParse(value)
  if (!parsed.success) return projectError('invalid-request', null)
  const registry = openRegistry(await readRegistry(registryPath))
  if (typeof registry === 'string') return projectError(registry, parsed.data.requestId)
  return listed(parsed.data.requestId, registry)
}
