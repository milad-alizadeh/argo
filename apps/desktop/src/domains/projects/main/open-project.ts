import { opendir } from 'node:fs/promises'
import {
  type ProjectOpenReply,
  type ProjectOpenRequest,
  projectError,
} from '@/domains/projects/contract/contract'
import { toSummary } from '@/domains/projects/main/presentation'
import {
  readProjectConfiguration,
  readProjectConfigurationSource,
} from '@/domains/projects/main/project-configuration'
import type { ProjectStore } from '@/domains/projects/main/register-project'
import { isProjectStoreInvalid } from '@/domains/projects/main/sqlite-store'
import { isRecord } from '@/shared/validation'
import type { SetupDocument } from '../contract/setup-document'
import type { SetupCheckpoint } from './sqlite-store'

type OpenProjectStore = ProjectStore & { loadSetupDocument: () => Promise<SetupDocument> }

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
  store: OpenProjectStore,
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
  const configuration = await readProjectConfiguration(project.path)
  const configurationSource = await readProjectConfigurationSource(project.path)
  const checkpoint = store.projects.readSetupCheckpoint(project.id)
  const documentChanged = await setupDocumentChanged(checkpoint, store)
  if (
    configuration === null ||
    documentChanged ||
    (checkpoint?.phase === 'ready' && checkpoint.configurationSource !== configurationSource)
  ) {
    if (checkpoint) {
      store.projects.writeSetupCheckpoint({
        ...checkpoint,
        phase: 'editing',
        configurationSource: configurationSource ?? '',
      })
    }
    return {
      version: 1,
      type: 'project.setup-required',
      requestId: request.requestId,
      project: { id: summary.id, name: summary.name },
    }
  }
  return {
    version: 1,
    type: 'project.opened',
    requestId: request.requestId,
    project: { id: summary.id, name: summary.name },
  }
}

async function setupDocumentChanged(
  checkpoint: SetupCheckpoint | null,
  store: Pick<OpenProjectStore, 'loadSetupDocument'>,
) {
  if (checkpoint?.phase !== 'ready') return false
  try {
    return (await store.loadSetupDocument()).revision !== checkpoint.documentRevision
  } catch {
    return false
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
