import { z } from 'zod'
import { identifierSchema } from '../../boundary'

// One channel carries every Project action. The action is a field of the message, never a channel
// the renderer picks, so the bridge has one entry point to validate.
export const PROJECT_CHANNEL = 'argo:project'

export const projectOpenRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.open'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectOpenRequest = z.infer<typeof projectOpenRequestSchema>

export const projectOpenedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.opened'),
  requestId: identifierSchema,
  project: z.strictObject({ id: identifierSchema, name: z.string().min(1) }),
})
export type ProjectOpened = z.infer<typeof projectOpenedSchema>

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
export const projectErrorSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('project.error'),
    requestId: identifierSchema.nullable(),
    code: z.enum(Object.keys(PROJECT_ERRORS) as [ProjectErrorCode, ...ProjectErrorCode[]]),
    message: z.string(),
  })
  .refine(({ code, message }) => message === PROJECT_ERRORS[code])
export type ProjectError = z.infer<typeof projectErrorSchema>
export type ProjectOpenReply = ProjectOpened | ProjectError

export function projectError(code: ProjectErrorCode, requestId: string | null): ProjectError {
  return { version: 1, type: 'project.error', requestId, code, message: PROJECT_ERRORS[code] }
}

// Every action shares one shape: version 1, a named type, a request ID, and zero or more further
// identifier fields. Extra fields are refused rather than ignored, so a request cannot smuggle a
// path or a channel past the guard.
export function isAction(value: unknown, type: string, identifiers: string[] = []): boolean {
  const parsed = z
    .object({ version: z.literal(1), type: z.literal(type), requestId: identifierSchema })
    .catchall(identifierSchema)
    .safeParse(value)
  return (
    parsed.success &&
    Object.keys(parsed.data).length === identifiers.length + 3 &&
    identifiers.every((identifier) => identifier in parsed.data)
  )
}

export function isProjectOpenRequest(value: unknown): value is ProjectOpenRequest {
  return projectOpenRequestSchema.safeParse(value).success
}

export function isProjectOpened(value: unknown): value is ProjectOpened {
  return projectOpenedSchema.safeParse(value).success
}

// The error text has to be one of the table's own strings, so a reply cannot carry a message the
// main process assembled from an exception.
export function isProjectErrorMessage(value: unknown): value is ProjectError {
  return projectErrorSchema.safeParse(value).success
}

export function isProjectOpenReply(value: unknown): value is ProjectOpenReply {
  return isProjectOpened(value) || isProjectErrorMessage(value)
}
