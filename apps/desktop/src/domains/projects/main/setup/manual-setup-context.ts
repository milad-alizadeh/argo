import { type ProjectError, projectError } from '../../contract/contract'
import type { SetupCheckpoint } from '../sqlite-store'
import { projectFor, type SetupStore } from './setup-context'

export function manualSetupContext(
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
