import { opendir } from 'node:fs/promises'
import {
  type ProjectOpenReply,
  type ProjectOpenRequest,
  projectError,
} from '@/domains/projects/contract/contract'
import { toSummary } from '@/domains/projects/main/presentation'
import type { ProjectStore } from '@/domains/projects/main/register-project'
import { isProjectStoreInvalid } from '@/domains/projects/main/sqlite-store'
import { isRecord } from '@/shared/validation'

// A store failure prevents Project opening, while `project.list` can still report an empty cockpit.
function loadProjects(store: ProjectStore) {
  try {
    return store.projects.read().projects
  } catch (error) {
    return projectError(
      isProjectStoreInvalid(error) ? 'storage-invalid' : 'storage-unavailable',
      null,
    )
  }
}

export async function openProject(
  request: ProjectOpenRequest,
  store: ProjectStore,
): Promise<ProjectOpenReply> {
  const projects = loadProjects(store)
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
