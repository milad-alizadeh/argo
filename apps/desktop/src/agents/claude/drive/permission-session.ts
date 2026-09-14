import type {
  ClaudeSessionPermissionDecisionReply,
  ClaudeSessionPermissionDecisionRequest,
  ClaudeSessionPermissionReply,
  ClaudeSessionPermissionRequest,
} from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'

export function readClaudePermission(
  request: ClaudeSessionPermissionRequest,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionReply {
  return {
    version: 1,
    type: 'session.claude.permission.read',
    requestId: request.requestId,
    sessionId: request.sessionId,
    permission: driver.pendingPermission(request.sessionId),
  }
}

export function decideClaudePermission(
  request: ClaudeSessionPermissionDecisionRequest,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionDecisionReply {
  if (!driver.decidePermission(request.sessionId, request.permissionId, request.decision)) {
    return sessionError('stale-permission', request.requestId)
  }
  return {
    version: 1,
    type: 'session.claude.accepted',
    requestId: request.requestId,
    sessionId: request.sessionId,
  }
}
