import { hasKeys, isIdentifier, isRecord, requestIdentifier } from '../boundary'

// Re-exported so the Project module keeps one contract face; the definitions are shared.
export { hasKeys, isIdentifier, isRecord, requestIdentifier }

export const PROJECT_OPEN_CHANNEL = 'argo:project:open'

export type ProjectOpenRequest = {
  version: 1
  type: 'project.open'
  requestId: string
  projectId: string
}

export type ProjectOpened = {
  version: 1
  type: 'project.opened'
  requestId: string
  project: { id: string; name: string }
}

export const PROJECT_ERRORS = {
  'missing-project': 'This Project is not registered.',
  'access-denied': 'Argo cannot access this Project.',
  'invalid-request': 'The Project request is invalid.',
  'unsupported-version': 'This Project contract version is not supported.',
  'project-unavailable': 'The registered Project folder is unavailable.',
  'internal-error': 'Argo could not open this Project.',
  'storage-invalid': 'The Project registry cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the Project registry.',
  'invalid-response': 'Argo received an invalid Project response.',
  'connection-lost': 'The connection to Argo was lost.',
} as const

export type ProjectErrorCode = keyof typeof PROJECT_ERRORS
export type ProjectError = {
  version: 1
  type: 'project.error'
  requestId: string | null
  code: ProjectErrorCode
  message: string
}
export type ProjectOpenReply = ProjectOpened | ProjectError

export function projectError(code: ProjectErrorCode, requestId: string | null): ProjectError {
  return { version: 1, type: 'project.error', requestId, code, message: PROJECT_ERRORS[code] }
}

export function isProjectOpenRequest(value: unknown): value is ProjectOpenRequest {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', 'projectId']) &&
    value.version === 1 &&
    value.type === 'project.open' &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.projectId)
  )
}

export function isProjectOpenReply(value: unknown): value is ProjectOpenReply {
  if (!isRecord(value) || value.version !== 1) return false
  switch (value.type) {
    case 'project.opened':
      return (
        hasKeys(value, ['version', 'type', 'requestId', 'project']) &&
        isIdentifier(value.requestId) &&
        isRecord(value.project) &&
        hasKeys(value.project, ['id', 'name']) &&
        isIdentifier(value.project.id) &&
        typeof value.project.name === 'string' &&
        value.project.name.length > 0
      )
    case 'project.error':
      return (
        hasKeys(value, ['version', 'type', 'requestId', 'code', 'message']) &&
        (value.requestId === null || isIdentifier(value.requestId)) &&
        Object.entries(PROJECT_ERRORS).some(
          ([code, message]) => value.code === code && value.message === message,
        )
      )
    default:
      return false
  }
}
