import { requestIdentifier } from '@/boundary'
import {
  isClaudeSessionPermissionDecisionRequest,
  isClaudeSessionPermissionRequest,
  sessionError,
  type ClaudeSessionPermissionDecisionReply,
  type ClaudeSessionPermissionReply,
} from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'

export function readClaudePermission(
  value: unknown,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionReply {
  const requestId = requestIdentifier(value)
  if (!isClaudeSessionPermissionRequest(value)) return sessionError('invalid-request', requestId)
  return {
    version: 1,
    type: 'session.claude.permission.read',
    requestId: value.requestId,
    sessionId: value.sessionId,
    permission: driver.pendingPermission(value.sessionId),
  }
}

export function decideClaudePermission(
  value: unknown,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionDecisionReply {
  const requestId = requestIdentifier(value)
  if (!isClaudeSessionPermissionDecisionRequest(value))
    return sessionError('invalid-request', requestId)
  if (!driver.decidePermission(value.sessionId, value.permissionId, value.decision)) {
    return sessionError('stale-permission', value.requestId)
  }
  return {
    version: 1,
    type: 'session.claude.accepted',
    requestId: value.requestId,
    sessionId: value.sessionId,
  }
}
