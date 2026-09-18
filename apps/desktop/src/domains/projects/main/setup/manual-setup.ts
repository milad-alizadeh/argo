import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type ProjectError,
  type ProjectSetupCancelled,
  type ProjectSetupEditing,
  type ProjectSetupValidated,
  projectError,
} from '../contract'
import { toSummary } from '../presentation'
import type {
  ProjectStore as ProjectRegistryStore,
  SetupCheckpoint,
  SetupPhase,
} from '../sqlite-store'
import { saveManualProjectConfiguration } from './manual-configuration'
import { validateProjectConfiguration } from './setup-validation'
import { prepareSetupWorktree } from './setup-worktree'

export const MANUAL_CONFIGURATION_TEMPLATE = `${JSON.stringify(
  {
    version: 1,
    targets: {
      app: { default: true, path: '.', setup: '', run: '', build: '', test: '' },
    },
  },
  null,
  2,
)}\n`

type SetupStore = {
  projects: Pick<
    ProjectRegistryStore,
    'read' | 'readSetupCheckpoint' | 'updateProjectPath' | 'writeSetupCheckpoint'
  >
}

export async function beginManualSetup(
  request: { projectId: string; requestId: string },
  store: SetupStore,
): Promise<ProjectSetupEditing | ProjectError> {
  const project = projectFor(request.projectId, store.projects)
  if (!project) return projectError('missing-project', request.requestId)
  try {
    const checkpoint = store.projects.readSetupCheckpoint(project.id)
    const worktreePath = checkpoint?.worktreePath ?? (await prepareSetupWorktree(project))
    const source = await manualSource(worktreePath)
    store.projects.writeSetupCheckpoint(checkpointFor(project.id, worktreePath, source))
    return editing(request.requestId, setupProject(project), source)
  } catch {
    return projectError('setup-unavailable', request.requestId)
  }
}

export async function saveManualSetup(
  request: { projectId: string; requestId: string; source: string },
  store: SetupStore,
): Promise<ProjectSetupEditing | ProjectError> {
  const project = projectFor(request.projectId, store.projects)
  if (!project) return projectError('missing-project', request.requestId)
  try {
    const checkpoint = await saveManualProjectConfiguration(project, request.source, store.projects)
    if (checkpoint.phase === 'ready')
      store.projects.updateProjectPath(project.id, checkpoint.worktreePath)
    return editing(
      request.requestId,
      setupProject(project),
      await manualSource(checkpoint.worktreePath),
    )
  } catch {
    return projectError('invalid-configuration', request.requestId)
  }
}

export async function validateManualSetup(
  request: { projectId: string; requestId: string; source: string },
  store: SetupStore,
): Promise<ProjectSetupValidated | ProjectError> {
  const context = manualSetupContext(request, store)
  if ('type' in context) return context
  const { checkpoint, project } = context
  const valid = await validateProjectConfiguration(checkpoint.worktreePath, request.source)
  store.projects.writeSetupCheckpoint({
    ...checkpoint,
    configurationSource: request.source,
    phase: valid ? 'ready' : 'failed',
  })
  return {
    version: 1,
    type: 'project.setup.validated',
    requestId: request.requestId,
    project: setupProject(project),
    valid,
  }
}

export function cancelManualSetup(
  request: { projectId: string; requestId: string },
  store: SetupStore,
): ProjectSetupCancelled | ProjectError {
  const context = manualSetupContext(request, store)
  if ('type' in context) return context
  const { checkpoint, project } = context
  store.projects.writeSetupCheckpoint({ ...checkpoint, phase: 'cancelled' })
  return {
    version: 1,
    type: 'project.setup.cancelled',
    requestId: request.requestId,
    project: setupProject(project),
  }
}

function checkpointFor(
  projectId: string,
  worktreePath: string,
  configurationSource: string,
): SetupCheckpoint {
  const phase: SetupPhase = 'editing'
  return { projectId, worktreePath, phase, configurationSource }
}

async function manualSource(worktreePath: string): Promise<string> {
  return readFile(path.join(worktreePath, '.argo', 'settings.json'), 'utf8').catch(
    () => MANUAL_CONFIGURATION_TEMPLATE,
  )
}

function editing(requestId: string, project: { id: string; name: string }, source: string) {
  return { version: 1 as const, type: 'project.setup.editing' as const, requestId, project, source }
}

function setupProject(project: Parameters<typeof toSummary>[0]) {
  const { id, name } = toSummary(project)
  return { id, name }
}

function projectFor(projectId: string, store: Pick<ProjectRegistryStore, 'read'>) {
  return store.read().projects.find(({ id }) => id === projectId)
}

function manualSetupContext(
  request: { projectId: string; requestId: string },
  store: SetupStore,
):
  | { project: NonNullable<ReturnType<typeof projectFor>>; checkpoint: SetupCheckpoint }
  | ProjectError {
  const project = projectFor(request.projectId, store.projects)
  if (!project) return projectError('missing-project', request.requestId)
  const checkpoint = store.projects.readSetupCheckpoint(project.id)
  return checkpoint
    ? { project, checkpoint }
    : projectError('invalid-configuration', request.requestId)
}
