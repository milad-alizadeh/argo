import { z } from 'zod'
import { identifierSchema } from '../../boundary'

// Codes a CLI cannot cause: reading the Roster, an untrusted caller, a stale contract version.
const SHARED_SESSION_ERRORS = {
  'missing-session': 'Argo cannot find this Session.',
  'invalid-request': 'The Session request is invalid.',
  'unsupported-version': 'This Session contract version is not supported.',
  'transcripts-unavailable': 'Argo cannot read the Claude transcript folder.',
  'access-denied': 'Argo cannot access these Sessions.',
  'internal-error': 'Argo could not read these Sessions.',
  'invalid-response': 'Argo received an invalid Session response.',
  'connection-lost': 'The connection to Argo was lost.',
} as const

// One failure kind, the same code for every CLI (#2030); only the message names which CLI failed.
const DRIVE_SESSION_ERRORS = {
  'cli-unavailable': {
    claude: 'Claude Code is not available. Run claude doctor to repair it.',
    codex: 'Codex is not available. Run codex doctor to repair it.',
  },
  'launch-failed': {
    claude: 'Argo could not start Claude Code.',
    codex: 'Argo could not start Codex.',
  },
  'not-drivable': {
    claude: 'Argo no longer holds this Claude Session.',
    codex: 'Argo no longer holds this Codex Session.',
  },
  'not-resumable': {
    claude: 'Argo did not start this Claude Session, so it cannot send to it.',
    codex: 'Argo did not start this Codex Session, so it cannot send to it.',
  },
  'held-elsewhere': {
    claude: 'Another Argo window is driving this Claude Session.',
    codex: 'Another Argo window is driving this Codex Session.',
  },
  'stale-permission': {
    claude: 'This Claude permission is no longer waiting.',
    codex: 'This Codex permission is no longer waiting.',
  },
  'stale-question': {
    claude: 'This Claude question is no longer waiting.',
    codex: 'This Codex question is no longer waiting.',
  },
} as const

export type SharedSessionErrorCode = keyof typeof SHARED_SESSION_ERRORS
export type DriveSessionErrorCode = keyof typeof DRIVE_SESSION_ERRORS
export type SessionErrorCode = SharedSessionErrorCode | DriveSessionErrorCode
export type DriveCli = keyof (typeof DRIVE_SESSION_ERRORS)['cli-unavailable']

const DRIVE_CODES = new Set<string>(Object.keys(DRIVE_SESSION_ERRORS))
const DRIVE_CLIS = new Set<string>(Object.keys(DRIVE_SESSION_ERRORS['cli-unavailable']))

function isDriveCode(code: SessionErrorCode): code is DriveSessionErrorCode {
  return DRIVE_CODES.has(code)
}

export function isDriveCli(value: string): value is DriveCli {
  return DRIVE_CLIS.has(value)
}

export const sessionErrorSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('session.error'),
    requestId: identifierSchema.nullable(),
    code: z.enum([...Object.keys(SHARED_SESSION_ERRORS), ...Object.keys(DRIVE_SESSION_ERRORS)] as [
      SessionErrorCode,
      ...SessionErrorCode[],
    ]),
    // The CLI a drive failure names; absent for a shared, CLI-agnostic code (nullish so a caller
    // that predates this field still parses as one).
    cli: z.string().nullish(),
    message: z.string(),
  })
  .refine(({ code, cli, message }) => {
    if (isDriveCode(code)) {
      const messages: Record<string, string> = DRIVE_SESSION_ERRORS[code]
      return typeof cli === 'string' && message === messages[cli]
    }
    return (cli ?? null) === null && message === SHARED_SESSION_ERRORS[code]
  })
export type SessionError = z.infer<typeof sessionErrorSchema>

export function sessionError(code: SharedSessionErrorCode, requestId: string | null): SessionError {
  return {
    version: 1,
    type: 'session.error',
    requestId,
    code,
    cli: null,
    message: SHARED_SESSION_ERRORS[code],
  }
}

// One failure kind for every CLI; the CLI it names picks the message (#2030).
export function driveSessionError(
  code: DriveSessionErrorCode,
  cli: DriveCli,
  requestId: string | null,
): SessionError {
  return {
    version: 1,
    type: 'session.error',
    requestId,
    code,
    cli,
    message: DRIVE_SESSION_ERRORS[code][cli],
  }
}

export function isSessionError(value: unknown): value is SessionError {
  return sessionErrorSchema.safeParse(value).success
}
