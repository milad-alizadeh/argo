import {
  sessionAcceptedReplySchema,
  sessionCompactRequestSchema,
  sessionFeedReplySchema,
  sessionFeedRequestSchema,
  sessionInterruptRequestSchema,
  sessionListReplySchema,
  sessionListRequestSchema,
  sessionPermissionDecisionRequestSchema,
  sessionPermissionReplySchema,
  sessionPermissionRequestSchema,
  sessionQuestionDecisionRequestSchema,
  sessionRenameReplySchema,
  sessionRenameRequestSchema,
  sessionSendRequestSchema,
  sessionStartReplySchema,
  sessionStartRequestSchema,
} from './contract'

// One drive table for every CLI (#2030): `start` names its CLI, and the rest carry only a
// sessionId, routed by the Session's owner.
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
  rename: {
    name: 'session.rename',
    channel: 'argo:session:rename',
    request: sessionRenameRequestSchema,
    reply: sessionRenameReplySchema,
  },
  start: {
    name: 'session.start',
    channel: 'argo:session:start',
    request: sessionStartRequestSchema,
    reply: sessionStartReplySchema,
  },
  send: {
    name: 'session.send',
    channel: 'argo:session:send',
    request: sessionSendRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
  interrupt: {
    name: 'session.interrupt',
    channel: 'argo:session:interrupt',
    request: sessionInterruptRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
  compact: {
    name: 'session.compact',
    channel: 'argo:session:compact',
    request: sessionCompactRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
  readPermission: {
    name: 'session.permission',
    channel: 'argo:session:permission',
    request: sessionPermissionRequestSchema,
    reply: sessionPermissionReplySchema,
  },
  decidePermission: {
    name: 'session.permission.decide',
    channel: 'argo:session:permission:decide',
    request: sessionPermissionDecisionRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
  decideQuestion: {
    name: 'session.question.decide',
    channel: 'argo:session:question:decide',
    request: sessionQuestionDecisionRequestSchema,
    reply: sessionAcceptedReplySchema,
  },
} as const
