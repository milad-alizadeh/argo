import { opendir, readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  isIdentifier,
  isProjectOpenRequest,
  isRecord,
  type ProjectOpenReply,
  projectError,
  requestIdentifier,
} from './contract'

function readProjects(value: unknown): { id: string; path: string }[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.projects)) {
    throw new Error('Invalid Project registry')
  }
  const identifiers = new Set<string>()
  return value.projects.map((project: unknown) => {
    if (
      !isRecord(project) ||
      !isIdentifier(project.id) ||
      identifiers.has(project.id) ||
      typeof project.path !== 'string' ||
      !path.isAbsolute(project.path) ||
      project.path.includes('\0')
    ) {
      throw new Error('Invalid Project registry')
    }
    identifiers.add(project.id)
    return { id: project.id, path: project.path }
  })
}

async function loadProjects(registryPath: string, requestId: string) {
  let content: string
  try {
    content = await readFile(registryPath, 'utf8')
  } catch {
    return projectError('storage-unavailable', requestId)
  }
  let projects: { id: string; path: string }[]
  try {
    projects = readProjects(JSON.parse(content))
  } catch {
    return projectError('storage-invalid', requestId)
  }
  return projects
}

export async function openProject(value: unknown, registryPath: string): Promise<ProjectOpenReply> {
  const requestId = requestIdentifier(value)
  if (isRecord(value) && typeof value.version === 'number' && value.version !== 1) {
    return projectError('unsupported-version', requestId)
  }
  if (!isProjectOpenRequest(value)) return projectError('invalid-request', requestId)
  const projects = await loadProjects(registryPath, value.requestId)
  if (!Array.isArray(projects)) return projects
  const project = projects.find((entry) => entry.id === value.projectId)
  if (!project) return projectError('missing-project', value.requestId)
  const failure = await projectAccessFailure(project.path)
  if (failure) return projectError(failure, value.requestId)
  return {
    version: 1,
    type: 'project.opened',
    requestId: value.requestId,
    project: { id: project.id, name: path.basename(project.path) || project.path },
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
