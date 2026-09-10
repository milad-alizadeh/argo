// Parsing a reply back into a known shape at the renderer's edge. The main process built these
// values, but the renderer's own boundary is the bridge, so it reads them the same way it reads
// anything from outside: once, into a shape, before anything draws them.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
import {
  isSessionError,
  type SessionFeedReply,
  type SessionListReply,
  type SessionsListed,
} from './contract'
import { SESSION_ENTRIES, SESSION_POSTURES, SESSION_STATUSES, TITLE_SOURCES } from './models'

// The closed sets are the domain's own, imported rather than copied: a check against a second
// list would pass a value the type refuses, or refuse one it allows, and nothing would say which.
function isMember(set: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && set.includes(value)
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isTitle(value: unknown): boolean {
  if (value === null) return true
  return (
    isRecord(value) &&
    hasKeys(value, ['text', 'source']) &&
    typeof value.text === 'string' &&
    isMember(TITLE_SOURCES, value.source)
  )
}

function isRosterRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  const keys = ['id', 'retiredIds', 'cli', 'posture', 'title', 'status', 'entry', 'cwd', 'branch']
  return (
    hasKeys(value, [...keys, 'updatedAt', 'unreadableLines', 'originUnread']) &&
    isIdentifier(value.id) &&
    isStringArray(value.retiredIds) &&
    isIdentifier(value.cli) &&
    isMember(SESSION_POSTURES, value.posture) &&
    isTitle(value.title) &&
    isMember(SESSION_STATUSES, value.status) &&
    isMember(SESSION_ENTRIES, value.entry) &&
    isNullableString(value.cwd) &&
    isNullableString(value.branch) &&
    isNullableString(value.updatedAt) &&
    typeof value.unreadableLines === 'number' &&
    typeof value.originUnread === 'boolean'
  )
}

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
      hasKeys(value, ['version', 'type', 'requestId', 'sessionId', 'chainId', 'rows']) &&
      isIdentifier(value.requestId) &&
      isIdentifier(value.sessionId) &&
      isIdentifier(value.chainId) &&
      Array.isArray(value.rows) &&
      value.rows.every(isFeedRow)
    )
  }
  return value.type === 'session.error' && isSessionError(value)
}
