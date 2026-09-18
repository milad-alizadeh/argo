import { type ProjectError, projectError } from '../../contract/contract'
import type { SetupDocument } from '../../contract/setup-document'
import type { ProjectStore as ProjectRegistryStore } from '../sqlite-store'
import { SetupDocumentLoadError } from './setup-bundle'

const SETUP_DOCUMENT_ERROR_CODES = {
  'network-unavailable': 'setup-network-unavailable',
  'document-invalid': 'setup-document-invalid',
} as const satisfies Record<SetupDocumentLoadError['reason'], ProjectError['code']>

export type SetupStore = {
  projects: Pick<
    ProjectRegistryStore,
    'read' | 'readSetupCheckpoint' | 'updateProjectPath' | 'writeSetupCheckpoint'
  >
  loadSetupDocument: () => Promise<SetupDocument>
}

export function projectFor(projectId: string, store: Pick<ProjectRegistryStore, 'read'>) {
  return store.read().projects.find(({ id }) => id === projectId)
}

export async function setupContext(
  request: { projectId: string; requestId: string },
  store: SetupStore,
): Promise<
  { project: NonNullable<ReturnType<typeof projectFor>>; document: SetupDocument } | ProjectError
> {
  const project = projectFor(request.projectId, store.projects)
  if (!project) return projectError('missing-project', request.requestId)
  try {
    return { project, document: await store.loadSetupDocument() }
  } catch (error) {
    if (error instanceof SetupDocumentLoadError) {
      return projectError(SETUP_DOCUMENT_ERROR_CODES[error.reason], request.requestId)
    }
    return projectError('setup-unavailable', request.requestId)
  }
}
