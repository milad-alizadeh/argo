import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

// Codes a Harness cannot cause: reading the Roster, an untrusted caller, a stale contract version.
const SHARED_SESSION_ERRORS = {
  'missing-session': 'Argo cannot find this Session.',
  'invalid-request': 'The Session request is invalid.',
  'unsupported-version': 'This Session contract version is not supported.',
  'transcripts-unavailable': 'Argo cannot read this Harness transcript folder.',
  'access-denied': 'Argo cannot access these Sessions.',
  'internal-error': 'Argo could not read these Sessions.',
  'invalid-response': 'Argo received an invalid Session response.',
  'connection-lost': 'The connection to Argo was lost.',
  cancelled: 'Argo cancelled this Session read.',
} as const

// One failure kind, the same code for every Harness (#2030); only the message names which Harness failed.
const DRIVE_SESSION_ERROR_CODES = [
  'harness-unavailable',
  'launch-failed',
  'not-drivable',
  'held-elsewhere',
  'stale-permission',
  'stale-question',
] as const

export type SharedSessionErrorCode = keyof typeof SHARED_SESSION_ERRORS
export type DriveSessionErrorCode = (typeof DRIVE_SESSION_ERROR_CODES)[number]
export type SessionErrorCode = SharedSessionErrorCode | DriveSessionErrorCode

const DRIVE_CODES = new Set<string>(DRIVE_SESSION_ERROR_CODES)

function isDriveCode(code: SessionErrorCode): code is DriveSessionErrorCode {
  return DRIVE_CODES.has(code)
}

export const sessionErrorSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('session.error'),
    requestId: identifierSchema.nullable(),
    code: z.enum([
      ...Object.keys(SHARED_SESSION_ERRORS),
      ...DRIVE_SESSION_ERROR_CODES,
    ] as unknown as [SessionErrorCode, ...SessionErrorCode[]]),
    // The Harness a drive failure names; absent for a shared, Harness-agnostic code (nullish so a caller
    // that predates this field still parses as one).
    harness: z.string().nullish(),
    message: z.string(),
  })
  .refine(({ code, harness, message }) => {
    if (isDriveCode(code)) {
      return typeof harness === 'string' && message.length > 0
    }
    return (harness ?? null) === null && message === SHARED_SESSION_ERRORS[code]
  })
export type SessionError = z.infer<typeof sessionErrorSchema>

export function sessionError(code: SharedSessionErrorCode, requestId: string | null): SessionError {
  return {
    version: 1,
    type: 'session.error',
    requestId,
    code,
    harness: null,
    message: SHARED_SESSION_ERRORS[code],
  }
}

// One failure kind for every Harness; the Harness supplies the reader-facing message at its edge.
export function driveSessionError(
  code: DriveSessionErrorCode,
  harness: string,
  requestId: string | null,
): SessionError {
  return driveSessionErrorWithMessage(code, {
    harness,
    requestId,
    message: `Argo could not drive this ${harness} Session.`,
  })
}

export function driveSessionErrorWithMessage(
  code: DriveSessionErrorCode,
  { harness, requestId, message }: { harness: string; requestId: string | null; message: string },
): SessionError {
  return {
    version: 1,
    type: 'session.error',
    requestId,
    code,
    harness,
    message,
  }
}

export function isSessionError(value: unknown): value is SessionError {
  return sessionErrorSchema.safeParse(value).success
}
