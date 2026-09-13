import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const SESSION_ERRORS = {
  'missing-session': 'Argo cannot find this Session.',
  'invalid-request': 'The Session request is invalid.',
  'unsupported-version': 'This Session contract version is not supported.',
  'transcripts-unavailable': 'Argo cannot read the Claude transcript folder.',
  'access-denied': 'Argo cannot access these Sessions.',
  'internal-error': 'Argo could not read these Sessions.',
  'invalid-response': 'Argo received an invalid Session response.',
  'connection-lost': 'The connection to Argo was lost.',
  'cli-unavailable': 'Claude Code is not available. Run claude doctor to repair it.',
  'launch-failed': 'Argo could not start Claude Code.',
  'not-drivable': 'Argo no longer holds this Claude Session.',
  'stale-permission': 'This Claude permission is no longer waiting.',
} as const

export type SessionErrorCode = keyof typeof SESSION_ERRORS
export const sessionErrorSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('session.error'),
    requestId: identifierSchema.nullable(),
    code: z.enum(Object.keys(SESSION_ERRORS) as [SessionErrorCode, ...SessionErrorCode[]]),
    message: z.string(),
  })
  .refine(({ code, message }) => message === SESSION_ERRORS[code])
export type SessionError = z.infer<typeof sessionErrorSchema>

export function sessionError(code: SessionErrorCode, requestId: string | null): SessionError {
  return { version: 1, type: 'session.error', requestId, code, message: SESSION_ERRORS[code] }
}

export function isSessionError(value: unknown): value is SessionError {
  return sessionErrorSchema.safeParse(value).success
}
