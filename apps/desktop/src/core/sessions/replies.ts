// Parsing a reply back into a known shape at the renderer's edge. The main process built these
// values, but the renderer's own boundary is the bridge, so it reads them the same way it reads
// anything from outside: once, into a shape, before anything draws them.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionPermissionDecisionReply,
  type ClaudeSessionPermissionReply,
  type ClaudeSessionSendReply,
  type ClaudeSessionStartReply,
  isClaudeSessionAccepted,
  isClaudeSessionStarted,
  isClaudeSessionPermissionRead,
  isSessionError,
  type SessionFeedReply,
  type SessionListReply,
  type SessionsListed,
} from './contract'
import { FEED_MARKERS } from './models'
import { isRosterRow } from './roster-row-check'

function isFeedRow(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string') return false
  const role = value.role === 'user' || value.role === 'assistant'
  switch (value.shape) {
    case 'prose':
      return (
        hasKeys(value, ['shape', 'id', 'role', 'text']) && role && typeof value.text === 'string'
      )
    case 'source':
      return (
        hasKeys(value, ['shape', 'id', 'role', 'label', 'source']) &&
        role &&
        typeof value.label === 'string' &&
        typeof value.source === 'string'
      )
    case 'marker':
      return (
        hasKeys(value, ['shape', 'id', 'marker']) &&
        (FEED_MARKERS as readonly unknown[]).includes(value.marker)
      )
    case 'thought':
      return hasKeys(value, ['shape', 'id', 'text']) && typeof value.text === 'string'
    case 'unreadable':
      return hasKeys(value, ['shape', 'id'])
    default:
      return false
  }
}

function isListed(value: Record<string, unknown>): value is SessionsListed {
  return (
    hasKeys(value, [
      'version',
      'type',
      'requestId',
      'sessions',
      'filesFound',
      'filesRead',
      'filesUnreadable',
    ]) &&
    isIdentifier(value.requestId) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isRosterRow) &&
    [value.filesFound, value.filesRead, value.filesUnreadable].every(
      (count) => typeof count === 'number',
    )
  )
}

export function isSessionListReply(value: unknown): value is SessionListReply {
  if (!isRecord(value) || value.version !== 1) return false
  if (value.type === 'session.listed') return isListed(value)
  return value.type === 'session.error' && isSessionError(value)
}

export function isSessionFeedReply(value: unknown): value is SessionFeedReply {
  if (!isRecord(value) || value.version !== 1) return false
  if (value.type === 'session.feed.read') {
    return (
      hasKeys(value, [
        'version',
        'type',
        'requestId',
        'sessionId',
        'chainId',
        'revision',
        'rows',
      ]) &&
      isIdentifier(value.requestId) &&
      isIdentifier(value.sessionId) &&
      isIdentifier(value.chainId) &&
      typeof value.revision === 'string' &&
      Array.isArray(value.rows) &&
      value.rows.every(isFeedRow)
    )
  }
  if (value.type === 'session.feed.unchanged') {
    return (
      hasKeys(value, ['version', 'type', 'requestId', 'sessionId', 'chainId', 'revision']) &&
      isIdentifier(value.requestId) &&
      isIdentifier(value.sessionId) &&
      isIdentifier(value.chainId) &&
      typeof value.revision === 'string'
    )
  }
  return value.type === 'session.error' && isSessionError(value)
}

export function isClaudeSessionStartReply(value: unknown): value is ClaudeSessionStartReply {
  return isClaudeSessionStarted(value) || (isRecord(value) && isSessionError(value))
}

export function isClaudeSessionSendReply(value: unknown): value is ClaudeSessionSendReply {
  return isClaudeSessionAccepted(value) || (isRecord(value) && isSessionError(value))
}

export function isClaudeSessionInterruptReply(
  value: unknown,
): value is ClaudeSessionInterruptReply {
  return isClaudeSessionAccepted(value) || (isRecord(value) && isSessionError(value))
}

export function isClaudeSessionPermissionReply(
  value: unknown,
): value is ClaudeSessionPermissionReply {
  return isClaudeSessionPermissionRead(value) || (isRecord(value) && isSessionError(value))
}

export function isClaudeSessionPermissionDecisionReply(
  value: unknown,
): value is ClaudeSessionPermissionDecisionReply {
  return isClaudeSessionAccepted(value) || (isRecord(value) && isSessionError(value))
}
