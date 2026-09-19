import { z } from 'zod'
import { identifierSchema } from '../../../shared/validation'
import { setupDocumentSchema } from './setup-document'

export const projectOpenRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.open'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectOpenRequest = z.infer<typeof projectOpenRequestSchema>

const projectLabelSchema = z.strictObject({ id: identifierSchema, name: z.string().min(1) })

export const projectOpenedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.opened'),
  requestId: identifierSchema,
  project: projectLabelSchema,
})
export type ProjectOpened = z.infer<typeof projectOpenedSchema>

export const projectSetupRequiredSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup-required'),
  requestId: identifierSchema,
  project: projectLabelSchema,
})
export type ProjectSetupRequired = z.infer<typeof projectSetupRequiredSchema>

export const projectSetupBeginRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.begin'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectSetupBeginRequest = z.infer<typeof projectSetupBeginRequestSchema>

export const projectSetupSaveRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.save'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  source: z.string().min(1).max(100_000),
})
export type ProjectSetupSaveRequest = z.infer<typeof projectSetupSaveRequestSchema>

export const projectSetupValidateRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.validate'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  source: z.string(),
})
export type ProjectSetupValidateRequest = z.infer<typeof projectSetupValidateRequestSchema>

export const projectSetupEditingSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.editing'),
  requestId: identifierSchema,
  project: projectLabelSchema,
  source: z.string(),
  document: setupDocumentSchema,
  saved: z.boolean(),
})
export type ProjectSetupEditing = z.infer<typeof projectSetupEditingSchema>

export const projectSetupValidatedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.validated'),
  requestId: identifierSchema,
  project: projectLabelSchema,
  valid: z.boolean(),
})
export type ProjectSetupValidated = z.infer<typeof projectSetupValidatedSchema>

export const projectSetupCancelledSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.cancelled'),
  requestId: identifierSchema,
  project: projectLabelSchema,
})
export type ProjectSetupCancelled = z.infer<typeof projectSetupCancelledSchema>

export const projectSetupCancelRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.cancel'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectSetupCancelRequest = z.infer<typeof projectSetupCancelRequestSchema>

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
  'invalid-configuration':
    'The Project configuration is not valid. Every target needs a path and four commands: setup, run, build and test.',
  'setup-unavailable': 'Argo could not prepare Project setup.',
  'setup-network-unavailable': 'Argo could not download Project setup from GitHub.',
  'setup-document-invalid': 'GitHub returned an invalid Project setup document.',
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
export type ProjectOpenReply = ProjectOpened | ProjectSetupRequired | ProjectError
export type ProjectSetupReply =
  | ProjectSetupEditing
  | ProjectSetupValidated
  | ProjectSetupCancelled
  | ProjectError

export function projectError(code: ProjectErrorCode, requestId: string | null): ProjectError {
  return { version: 1, type: 'project.error', requestId, code, message: PROJECT_ERRORS[code] }
}

// Every action shares one shape: version 1, a named type, a request ID, and zero or more further
// identifier fields. Extra fields are refused rather than ignored, so a request cannot smuggle a
// path or a channel past the guard.
