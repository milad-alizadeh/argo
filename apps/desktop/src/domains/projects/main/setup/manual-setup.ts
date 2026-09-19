import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  type ProjectError,
  type ProjectSetupCancelled,
  type ProjectSetupEditing,
  type ProjectSetupValidated,
  projectError,
} from '@/domains/projects/contract/contract'
import { toSummary } from '@/domains/projects/main/presentation'
import { saveManualProjectConfiguration } from '@/domains/projects/main/setup/manual-configuration'
import { validateProjectConfiguration } from '@/domains/projects/main/setup/setup-validation'
import { prepareSetupWorktree } from '@/domains/projects/main/setup/setup-worktree'
import type { SetupCheckpoint } from '@/domains/projects/main/sqlite-store'
import { setupConfiguration } from '../../contract/setup-configuration'
import type { SetupDocument } from '../../contract/setup-document'
import { projectFor, type SetupStore, setupContext } from './setup-context'

export async function beginManualSetup(
  request: { projectId: string; requestId: string },
  store: SetupStore,
): Promise<ProjectSetupEditing | ProjectError> {
  const context = await setupContext(request, store)
  if ('type' in context) return context
  const { document, project } = context
  try {
    const checkpoint = store.projects.readSetupCheckpoint(project.id)
    const worktreePath = checkpoint?.worktreePath ?? (await prepareSetupWorktree(project))
    const stored = await readFile(path.join(worktreePath, '.argo', 'settings.json'), 'utf8').catch(
      () => null,
    )
    const file = {
      source: stored ?? setupConfiguration(document, {}),
      saved: stored !== null,
    }
    store.projects.writeSetupCheckpoint({
      projectId: project.id,
      worktreePath,
      phase: 'editing',
      configurationSource: file.source,
      documentRevision: document.revision,
    })
    return editing({
      requestId: request.requestId,
      project: setupProject(project),
      ...file,
      document,
    })
  } catch {
    return projectError('setup-unavailable', request.requestId)
  }
}

export async function saveManualSetup(
  request: { projectId: string; requestId: string; source: string },
  store: SetupStore,
): Promise<ProjectSetupEditing | ProjectError> {
  const context = await setupContext(request, store)
  if ('type' in context) return context
  const { document, project } = context
  try {
    const reviewedRevision =
      store.projects.readSetupCheckpoint(project.id)?.documentRevision ?? document.revision
    const checkpoint = await saveManualProjectConfiguration({
      documentRevision: reviewedRevision,
      project,
      source: request.source,
      store: store.projects,
    })
    if (checkpoint.phase === 'ready')
      store.projects.updateProjectPath(project.id, checkpoint.worktreePath)
    return editing({
      requestId: request.requestId,
      project: setupProject(project),
      source: request.source,
      saved: true,
      document,
    })
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

function editing(reply: {
  requestId: string
  project: { id: string; name: string }
  source: string
  saved: boolean
  document: SetupDocument
}) {
  return {
    version: 1 as const,
    type: 'project.setup.editing' as const,
    ...reply,
  }
}

function setupProject(project: Parameters<typeof toSummary>[0]) {
  const { id, name } = toSummary(project)
  return { id, name }
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
