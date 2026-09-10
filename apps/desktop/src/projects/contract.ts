// One channel carries every Project action. The action is a field of the message, never a channel
// the renderer picks, so the bridge has one entry point to validate.
export const PROJECT_CHANNEL = 'argo:project'

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
  'not-a-repository': 'That folder is not a git repository.',
  'already-registered': 'Another Project is already registered at that folder.',
  'git-unavailable': 'Argo cannot run git on this computer.',
  'storage-not-written': 'Argo could not save the Project registry.',
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[\s\p{Cc}]/u.test(value)
  )
}

export function requestIdentifier(value: unknown): string | null {
  return isRecord(value) && isIdentifier(value.requestId) ? value.requestId : null
}

export function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

// Every action shares one shape: version 1, a named type, a request ID, and zero or more further
// identifier fields. Extra fields are refused rather than ignored, so a request cannot smuggle a
// path or a channel past the guard.
export function isAction(value: unknown, type: string, identifiers: string[] = []): boolean {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', ...identifiers]) &&
    value.version === 1 &&
    value.type === type &&
    isIdentifier(value.requestId) &&
    identifiers.every((key) => isIdentifier(value[key]))
  )
}

export function isProjectOpenRequest(value: unknown): value is ProjectOpenRequest {
  return isAction(value, 'project.open', ['projectId'])
}

export function isProjectOpened(value: unknown): value is ProjectOpened {
  return (
    isRecord(value) &&
    value.version === 1 &&
    value.type === 'project.opened' &&
    hasKeys(value, ['version', 'type', 'requestId', 'project']) &&
    isIdentifier(value.requestId) &&
    isRecord(value.project) &&
    hasKeys(value.project, ['id', 'name']) &&
    isIdentifier(value.project.id) &&
    typeof value.project.name === 'string' &&
    value.project.name.length > 0
  )
}

// The error text has to be one of the table's own strings, so a reply cannot carry a message the
// main process assembled from an exception.
export function isProjectErrorMessage(value: unknown): value is ProjectError {
  return (
    isRecord(value) &&
    value.version === 1 &&
    value.type === 'project.error' &&
    hasKeys(value, ['version', 'type', 'requestId', 'code', 'message']) &&
    (value.requestId === null || isIdentifier(value.requestId)) &&
    Object.entries(PROJECT_ERRORS).some(
      ([code, message]) => value.code === code && value.message === message,
    )
  )
}

export function isProjectOpenReply(value: unknown): value is ProjectOpenReply {
  return isProjectOpened(value) || isProjectErrorMessage(value)
}
