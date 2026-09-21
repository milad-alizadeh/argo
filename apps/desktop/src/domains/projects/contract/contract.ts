import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

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

const projectSetupScreenSchema = z.enum(['choosing-method', 'manual', 'deferred', 'ready'])
const projectSetupCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('choose-manual') }),
  z.strictObject({ type: z.literal('defer') }),
  z.strictObject({ type: z.literal('back') }),
  z.strictObject({ type: z.literal('save-manual'), source: z.string().min(1).max(100_000) }),
  z.strictObject({ type: z.literal('resume-setup') }),
  z.strictObject({ type: z.literal('start-repair-or-upgrade') }),
])
export type ProjectSetupCommand = z.infer<typeof projectSetupCommandSchema>

export const projectSetupCommandRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.command'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  commandId: identifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  command: projectSetupCommandSchema,
})
export type ProjectSetupCommandRequest = z.infer<typeof projectSetupCommandRequestSchema>

export const projectSetupSnapshotRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.snapshot'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectSetupSnapshotRequest = z.infer<typeof projectSetupSnapshotRequestSchema>

export const projectSetupSnapshotSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.setup.snapshot'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  revision: z.number().int().nonnegative(),
  screen: projectSetupScreenSchema,
  manualSource: z.string(),
})
export type ProjectSetupSnapshot = z.infer<typeof projectSetupSnapshotSchema>

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
  'onboarding-run-not-found': 'This onboarding run is no longer available.',
  'onboarding-harness-unavailable': 'Argo cannot run guided setup with this harness yet.',
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
export type ProjectSetupReply = ProjectSetupSnapshot | ProjectError

export function projectError(code: ProjectErrorCode, requestId: string | null): ProjectError {
  return { version: 1, type: 'project.error', requestId, code, message: PROJECT_ERRORS[code] }
}

// Every action shares one shape: version 1, a named type, a request ID, and zero or more further
// identifier fields. Extra fields are refused rather than ignored, so a request cannot smuggle a
// path or a channel past the guard.
