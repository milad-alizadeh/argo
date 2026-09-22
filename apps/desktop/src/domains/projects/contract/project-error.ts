import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const PROJECT_ERROR_CODES = [
  'missing-project',
  'missing-workspace',
  'access-denied',
  'invalid-request',
  'unsupported-version',
  'project-unavailable',
  'internal-error',
  'storage-invalid',
  'storage-unavailable',
  'invalid-response',
  'connection-lost',
  'not-a-repository',
  'already-registered',
  'git-unavailable',
  'storage-not-written',
  'invalid-configuration',
  'setup-unavailable',
  'setup-network-unavailable',
  'setup-document-invalid',
  'onboarding-run-not-found',
  'onboarding-harness-unavailable',
] as const

export type ProjectErrorCode = (typeof PROJECT_ERROR_CODES)[number]
export const projectErrorSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.error'),
  requestId: identifierSchema.nullable(),
  code: z.enum(PROJECT_ERROR_CODES),
})
export type ProjectError = z.infer<typeof projectErrorSchema>

export function projectError(code: ProjectErrorCode, requestId: string | null): ProjectError {
  return { version: 1, type: 'project.error', requestId, code }
}
