import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionPermissionDecisionReply,
  type ClaudeSessionPermissionReply,
  claudeSessionPermissionDecisionRequestSchema,
  claudeSessionPermissionRequestSchema,
  sessionError,
} from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'

export function readClaudePermission(
  value: unknown,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionReply {
  const requestId = requestIdentifier(value)
  const parsed = claudeSessionPermissionRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', requestId)
  const request = parsed.data
  return {
    version: 1,
    type: 'session.claude.permission.read',
    requestId: request.requestId,
    sessionId: request.sessionId,
    permission: driver.pendingPermission(request.sessionId),
  }
}

export function decideClaudePermission(
  value: unknown,
  driver: ClaudeSessionDriver,
): ClaudeSessionPermissionDecisionReply {
  const requestId = requestIdentifier(value)
  const parsed = claudeSessionPermissionDecisionRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', requestId)
  const request = parsed.data
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
