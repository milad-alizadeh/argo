// Reading one Roster row back into its shape at the renderer's edge, beside `replies.ts`, which
// reads the reply the rows travel in.
import { hasKeys, isIdentifier, isRecord } from '../../boundary'
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

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0
}

function isActivity(value: unknown): boolean {
  if (value === null) return true
  return (
    isRecord(value) &&
    hasKeys(value, ['tool', 'target']) &&
    typeof value.tool === 'string' &&
    isNullableString(value.target)
  )
}

function isPlan(value: unknown): boolean {
  if (value === null) return true
  return (
    isRecord(value) &&
    hasKeys(value, ['total', 'completed', 'inProgress']) &&
    [value.total, value.completed, value.inProgress].every(isCount)
  )
}

function isPullRequest(value: unknown): boolean {
  if (value === null) return true
  return (
    isRecord(value) &&
    hasKeys(value, ['number', 'url', 'repository']) &&
    isCount(value.number) &&
    typeof value.url === 'string' &&
    isNullableString(value.repository)
  )
}

function isDelegation(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasKeys(value, ['id', 'label', 'landed']) &&
    typeof value.id === 'string' &&
    isNullableString(value.label) &&
    typeof value.landed === 'boolean'
  )
}

function isShellCommand(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasKeys(value, ['id', 'command', 'background']) &&
    typeof value.id === 'string' &&
    isNullableString(value.command) &&
    typeof value.background === 'boolean'
  )
}

// The facts the row's lines and its marker column are drawn from, beyond the row's identity.
function hasSignals(value: Record<string, unknown>): boolean {
  return (
    isNullableString(value.turnStartedAt) &&
    isActivity(value.activity) &&
    isPlan(value.plan) &&
    Array.isArray(value.delegations) &&
    value.delegations.every(isDelegation) &&
    Array.isArray(value.shell) &&
    value.shell.every(isShellCommand) &&
    isPullRequest(value.pullRequest)
  )
}

export function isRosterRow(value: unknown): boolean {
  if (!isRecord(value)) return false
  const keys = ['id', 'retiredIds', 'cli', 'posture', 'title', 'status', 'entry', 'cwd', 'branch']
  const signals = ['turnStartedAt', 'activity', 'plan', 'delegations', 'shell', 'pullRequest']
  return (
    hasKeys(value, [
      ...keys,
      'updatedAt',
      'unreadableLines',
      'originUnread',
      'archived',
      ...signals,
    ]) &&
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
    typeof value.originUnread === 'boolean' &&
    typeof value.archived === 'boolean' &&
    hasSignals(value)
  )
}
