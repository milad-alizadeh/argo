import { opendir } from 'node:fs/promises'
import { isRecord, requestIdentifier } from '../../boundary'
import { type ProjectOpenReply, projectError, projectOpenRequestSchema } from './contract'
import { readRegistry, toSummary } from './registry'

// Opening reads storage that must already exist, so an absent registry is a storage failure here
// where `project.list` reads it as an empty cockpit.
async function loadProjects(registryPath: string) {
  const read = await readRegistry(registryPath)
  if (read.ok) return read.registry.projects
  return projectError(read.reason === 'invalid' ? 'storage-invalid' : 'storage-unavailable', null)
}

export async function openProject(value: unknown, registryPath: string): Promise<ProjectOpenReply> {
  const requestId = requestIdentifier(value)
  if (isRecord(value) && typeof value.version === 'number' && value.version !== 1) {
    return projectError('unsupported-version', requestId)
  }
  const parsed = projectOpenRequestSchema.safeParse(value)
  if (!parsed.success) return projectError('invalid-request', requestId)
  const request = parsed.data
  const projects = await loadProjects(registryPath)
  if (!Array.isArray(projects)) return { ...projects, requestId: request.requestId }
  const project = projects.find((entry) => entry.id === request.projectId)
  if (!project) return projectError('missing-project', request.requestId)
  const failure = await projectAccessFailure(project.path)
  if (failure) return projectError(failure, request.requestId)
  // The display name is the registry's, so the cockpit's listing and its opened Project cannot
  // disagree about what a Project is called.
  const summary = toSummary(project)
  return {
    version: 1,
    type: 'project.opened',
    requestId: request.requestId,
    project: { id: summary.id, name: summary.name },
  }
}

async function projectAccessFailure(projectPath: string) {
  try {
    const directory = await opendir(projectPath)
    try {
      await directory.read()
    } finally {
      await directory.close()
    }
  } catch (error) {
    if (isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')) {
      return 'access-denied'
    }
    if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return 'project-unavailable'
    }
    return 'internal-error'
  }
  return null
}
