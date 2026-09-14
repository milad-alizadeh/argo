import {
  sessionAcceptedReplySchema,
  sessionFeedReplySchema,
  sessionFeedRequestSchema,
  sessionInterruptRequestSchema,
  sessionListReplySchema,
  sessionListRequestSchema,
  sessionPermissionDecisionRequestSchema,
  sessionPermissionReplySchema,
  sessionPermissionRequestSchema,
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
} as const
