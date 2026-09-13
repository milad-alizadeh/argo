import {
  claudeSessionInterruptRequestSchema,
  claudeSessionPermissionDecisionRequestSchema,
  claudeSessionPermissionReplySchema,
  claudeSessionPermissionRequestSchema,
  claudeSessionSendReplySchema,
  claudeSessionSendRequestSchema,
  claudeSessionStartReplySchema,
  claudeSessionStartRequestSchema,
  sessionFeedReplySchema,
  sessionFeedRequestSchema,
  sessionListReplySchema,
  sessionListRequestSchema,
} from './contract'

export const SESSION_OPERATIONS = {
  list: {
    name: 'session.list',
    channel: 'argo:session:list',
    request: sessionListRequestSchema,
    reply: sessionListReplySchema,
  },
  feed: {
    name: 'session.feed',
    channel: 'argo:session:feed',
    request: sessionFeedRequestSchema,
    reply: sessionFeedReplySchema,
  },
  startClaude: {
    name: 'session.claude.start',
    channel: 'argo:session:claude:start',
    request: claudeSessionStartRequestSchema,
    reply: claudeSessionStartReplySchema,
  },
  sendClaude: {
    name: 'session.claude.send',
    channel: 'argo:session:claude:send',
    request: claudeSessionSendRequestSchema,
    reply: claudeSessionSendReplySchema,
  },
  interruptClaude: {
    name: 'session.claude.interrupt',
    channel: 'argo:session:claude:interrupt',
    request: claudeSessionInterruptRequestSchema,
    reply: claudeSessionSendReplySchema,
  },
  readClaudePermission: {
    name: 'session.claude.permission',
    channel: 'argo:session:claude:permission',
    request: claudeSessionPermissionRequestSchema,
    reply: claudeSessionPermissionReplySchema,
  },
  decideClaudePermission: {
    name: 'session.claude.permission.decide',
    channel: 'argo:session:claude:permission:decide',
    request: claudeSessionPermissionDecisionRequestSchema,
    reply: claudeSessionSendReplySchema,
  },
} as const
