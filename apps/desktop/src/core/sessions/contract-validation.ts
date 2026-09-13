import {
  type ClaudeSessionAccepted,
  type ClaudeSessionInterruptRequest,
  type ClaudeSessionPermissionDecisionRequest,
  type ClaudeSessionPermissionRead,
  type ClaudeSessionPermissionRequest,
  type ClaudeSessionSendRequest,
  type ClaudeSessionStarted,
  type ClaudeSessionStartRequest,
  claudeSessionAcceptedSchema,
  claudeSessionInterruptRequestSchema,
  claudeSessionPermissionDecisionRequestSchema,
  claudeSessionPermissionReadSchema,
  claudeSessionPermissionRequestSchema,
  claudeSessionSendRequestSchema,
  claudeSessionStartedSchema,
  claudeSessionStartRequestSchema,
  type SessionFeedRequest,
  type SessionListRequest,
  sessionFeedRequestSchema,
  sessionListRequestSchema,
} from './contract'

export function isSessionListRequest(value: unknown): value is SessionListRequest {
  return sessionListRequestSchema.safeParse(value).success
}

export function isSessionFeedRequest(value: unknown): value is SessionFeedRequest {
  return sessionFeedRequestSchema.safeParse(value).success
}

export function isClaudeSessionStartRequest(value: unknown): value is ClaudeSessionStartRequest {
  return claudeSessionStartRequestSchema.safeParse(value).success
}

export function isClaudeSessionStarted(value: unknown): value is ClaudeSessionStarted {
  return claudeSessionStartedSchema.safeParse(value).success
}

export function isClaudeSessionSendRequest(value: unknown): value is ClaudeSessionSendRequest {
  return claudeSessionSendRequestSchema.safeParse(value).success
}

export function isClaudeSessionInterruptRequest(
  value: unknown,
): value is ClaudeSessionInterruptRequest {
  return claudeSessionInterruptRequestSchema.safeParse(value).success
}

export function isClaudeSessionAccepted(value: unknown): value is ClaudeSessionAccepted {
  return claudeSessionAcceptedSchema.safeParse(value).success
}

export function isClaudeSessionPermissionRequest(
  value: unknown,
): value is ClaudeSessionPermissionRequest {
  return claudeSessionPermissionRequestSchema.safeParse(value).success
}

export function isClaudeSessionPermissionRead(
  value: unknown,
): value is ClaudeSessionPermissionRead {
  return claudeSessionPermissionReadSchema.safeParse(value).success
}

export function isClaudeSessionPermissionDecisionRequest(
  value: unknown,
): value is ClaudeSessionPermissionDecisionRequest {
  return claudeSessionPermissionDecisionRequestSchema.safeParse(value).success
}
