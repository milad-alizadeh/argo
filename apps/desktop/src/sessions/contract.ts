// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { hasKeys, isIdentifier, isRecord } from '../boundary'
import type { FeedRow } from './feed'
import type { RosterRow } from './roster'

export const SESSION_LIST_CHANNEL = 'argo:session:list'
export const SESSION_FEED_CHANNEL = 'argo:session:feed'

export type SessionListRequest = { version: 1; type: 'session.list'; requestId: string }
export type SessionFeedRequest = {
  version: 1
  type: 'session.feed'
  requestId: string
  sessionId: string
}

export type SessionsListed = {
  version: 1
  type: 'session.listed'
  requestId: string
  sessions: RosterRow[]
  // What the pass reached, stated rather than implied. A Roster that read 200 of 1,055 files
  // says so; one that silently showed 200 rows would read as the whole machine.
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

export type SessionFeedRead = {
  version: 1
  type: 'session.feed.read'
  requestId: string
  // The id that was ASKED for, echoed so the caller can prove the reply is its own.
  sessionId: string
  // The Session that answered. A retired id follows the chain that took it, so this is not always
  // the id asked for (CONTEXT.md L2 · retired id). The renderer keys on the id it asked for; this
  // is here so a caller can tell that the two differ, and it is what the proofs assert against.
  chainId: string
  rows: FeedRow[]
}

export const SESSION_ERRORS = {
  'missing-session': 'Argo cannot find this Session.',
  'invalid-request': 'The Session request is invalid.',
  'unsupported-version': 'This Session contract version is not supported.',
  'transcripts-unavailable': 'Argo cannot read the Claude transcript folder.',
  'access-denied': 'Argo cannot access these Sessions.',
  'internal-error': 'Argo could not read these Sessions.',
  'invalid-response': 'Argo received an invalid Session response.',
  'connection-lost': 'The connection to Argo was lost.',
} as const

export type SessionErrorCode = keyof typeof SESSION_ERRORS
export type SessionError = {
  version: 1
  type: 'session.error'
  requestId: string | null
  code: SessionErrorCode
  message: string
}

export type SessionListReply = SessionsListed | SessionError
export type SessionFeedReply = SessionFeedRead | SessionError

export function sessionError(code: SessionErrorCode, requestId: string | null): SessionError {
  return { version: 1, type: 'session.error', requestId, code, message: SESSION_ERRORS[code] }
}

export function isSessionListRequest(value: unknown): value is SessionListRequest {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId']) &&
    value.version === 1 &&
    value.type === 'session.list' &&
    isIdentifier(value.requestId)
  )
}

export function isSessionFeedRequest(value: unknown): value is SessionFeedRequest {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', 'sessionId']) &&
    value.version === 1 &&
    value.type === 'session.feed' &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.sessionId)
  )
}

export function isSessionError(value: Record<string, unknown>): value is SessionError {
  return (
    hasKeys(value, ['version', 'type', 'requestId', 'code', 'message']) &&
    (value.requestId === null || isIdentifier(value.requestId)) &&
    Object.entries(SESSION_ERRORS).some(
      ([code, message]) => value.code === code && value.message === message,
    )
  )
}
