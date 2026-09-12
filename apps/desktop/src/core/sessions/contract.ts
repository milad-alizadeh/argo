// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
import type { SessionFeedRow, SessionRosterRow } from './models'

export const SESSION_LIST_CHANNEL = 'argo:session:list'
export const SESSION_FEED_CHANNEL = 'argo:session:feed'
export const SESSION_CLAUDE_START_CHANNEL = 'argo:session:claude:start'

export type SessionListRequest = { version: 1; type: 'session.list'; requestId: string }
export type SessionFeedRequest = {
  version: 1
  type: 'session.feed'
  requestId: string
  sessionId: string
  // The document the renderer already holds, if any. This keeps an unchanged reply from leaving
  // a reloaded or evicted deck without rows to draw.
  revision: string | null
}

export type ClaudeSessionStartRequest = {
  version: 1
  type: 'session.claude.start'
  requestId: string
  cwd: string
  prompt: string
}

export type ClaudeSessionStarted = {
  version: 1
  type: 'session.claude.started'
  requestId: string
  sessionId: string
}

export type SessionsListed = {
  version: 1
  type: 'session.listed'
  requestId: string
  sessions: SessionRosterRow[]
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
  // A main-process token for the exact projected document this reply carries. A different
  // revision must be measured before its rows enter the viewport, even when ids stay the same.
  revision: string
  rows: SessionFeedRow[]
}

// The selected chain's file stamps did not move, so the main process returns this compact reply
// instead of copying an unchanged whole document over IPC on every observation pass.
export type SessionFeedUnchanged = {
  version: 1
  type: 'session.feed.unchanged'
  requestId: string
  sessionId: string
  chainId: string
  revision: string
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
  'cli-unavailable': 'Claude Code is not available. Run claude doctor to repair it.',
  'launch-failed': 'Argo could not start Claude Code.',
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
export type SessionFeedReply = SessionFeedRead | SessionFeedUnchanged | SessionError
export type ClaudeSessionStartReply = ClaudeSessionStarted | SessionError

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
    hasKeys(value, ['version', 'type', 'requestId', 'sessionId', 'revision']) &&
    value.version === 1 &&
    value.type === 'session.feed' &&
    isIdentifier(value.requestId) &&
    isIdentifier(value.sessionId) &&
    (value.revision === null || typeof value.revision === 'string')
  )
}

export function isClaudeSessionStartRequest(value: unknown): value is ClaudeSessionStartRequest {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', 'cwd', 'prompt']) &&
    value.version === 1 &&
    value.type === 'session.claude.start' &&
    isIdentifier(value.requestId) &&
    typeof value.cwd === 'string' &&
    value.cwd.length > 0 &&
    typeof value.prompt === 'string' &&
    value.prompt.trim().length > 0
  )
}

export function isClaudeSessionStarted(value: unknown): value is ClaudeSessionStarted {
  return (
    isRecord(value) &&
    hasKeys(value, ['version', 'type', 'requestId', 'sessionId']) &&
    value.version === 1 &&
    value.type === 'session.claude.started' &&
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
