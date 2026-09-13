import { z } from 'zod'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  guard,
  identifier,
  message,
} from '../contract/messages'

// One channel carries every Project action. The action is a field of the message, never a channel
// the renderer picks, so the bridge has one entry point to validate.
export const PROJECT_CHANNEL = 'argo:project'

const openRequest = message('project.open', { projectId: identifier })
const opened = message('project.opened', {
  project: z.strictObject({ id: identifier, name: z.string().min(1) }),
})

export type ProjectOpenRequest = z.infer<typeof openRequest>
export type ProjectOpened = z.infer<typeof opened>

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
export type ProjectError = ContractError<'project.error', ProjectErrorCode>
export type ProjectOpenReply = ProjectOpened | ProjectError

export const projectError = errorFactory('project.error', PROJECT_ERRORS)
export const projectErrorSchema = errorSchema('project.error', PROJECT_ERRORS)

export const isProjectOpenRequest = guard(openRequest)
export const isProjectOpenReply = guard(z.union([opened, projectErrorSchema]))
