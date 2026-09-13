import { requestIdentifier } from '../../boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionInterruptRequest,
  type ClaudeSessionPermissionDecisionReply,
  type ClaudeSessionPermissionDecisionRequest,
  type ClaudeSessionPermissionReply,
  type ClaudeSessionPermissionRequest,
  type ClaudeSessionSendReply,
  type ClaudeSessionSendRequest,
  type ClaudeSessionStartReply,
  type ClaudeSessionStartRequest,
  type SessionFeedReply,
  type SessionFeedRequest,
  type SessionListReply,
  type SessionListRequest,
  sessionError,
} from './contract'
import {
  isClaudeSessionInterruptReply,
  isClaudeSessionPermissionDecisionReply,
  isClaudeSessionPermissionReply,
  isClaudeSessionSendReply,
  isClaudeSessionStartReply,
  isSessionFeedReply,
  isSessionListReply,
} from './replies'

export type SessionClient = {
  interruptClaudeSession(
    request: ClaudeSessionInterruptRequest,
  ): Promise<ClaudeSessionInterruptReply>
  sendClaudeSession(request: ClaudeSessionSendRequest): Promise<ClaudeSessionSendReply>
  startClaudeSession(request: ClaudeSessionStartRequest): Promise<ClaudeSessionStartReply>
  readClaudePermission(
    request: ClaudeSessionPermissionRequest,
  ): Promise<ClaudeSessionPermissionReply>
  decideClaudePermission(
    request: ClaudeSessionPermissionDecisionRequest,
  ): Promise<ClaudeSessionPermissionDecisionReply>
  listSessions(request: SessionListRequest): Promise<SessionListReply>
  readSessionFeed(request: SessionFeedRequest): Promise<SessionFeedReply>
}

type Invoke = (
  channel:
    | 'list'
    | 'feed'
    | 'startClaude'
    | 'sendClaude'
    | 'interruptClaude'
    | 'readClaudePermission'
    | 'decideClaudePermission',
  request: unknown,
) => Promise<unknown>

// A reply that is not the shape asked for, or answers a different request, is refused rather
// than drawn. `connection-lost` is the one failure the renderer cannot see any other way.
async function ask<Reply>(
  invoke: () => Promise<unknown>,
  check: (value: unknown) => value is Reply,
  requestId: string | null,
) {
  let reply: unknown
  try {
    reply = await invoke()
  } catch {
    return sessionError('connection-lost', requestId)
  }
  if (!check(reply)) return sessionError('invalid-response', requestId)
  return reply
}

function answersRequest(reply: { requestId: string | null }, requestId: string | null) {
  return reply.requestId === requestId
}

export function createSessionClient(invoke: Invoke): SessionClient {
  return {
    interruptClaudeSession: clientRequest(invoke, 'interruptClaude', isClaudeSessionInterruptReply),
    sendClaudeSession: clientRequest(invoke, 'sendClaude', isClaudeSessionSendReply),
    startClaudeSession: clientRequest(invoke, 'startClaude', isClaudeSessionStartReply),
    readClaudePermission: clientRequest(
      invoke,
      'readClaudePermission',
      isClaudeSessionPermissionReply,
    ),
    decideClaudePermission: clientRequest(
      invoke,
      'decideClaudePermission',
      isClaudeSessionPermissionDecisionReply,
    ),
    listSessions: clientRequest(invoke, 'list', isSessionListReply),
    async readSessionFeed(request) {
      const requestId = requestIdentifier(request)
      const reply = await ask(() => invoke('feed', request), isSessionFeedReply, requestId)
      if (!answersRequest(reply, requestId)) return sessionError('invalid-response', requestId)
      // A Feed that answers for a different Session would draw one Session's history under
      // another's name, so the identity is checked and not assumed.
      if (reply.type === 'session.feed.read' && reply.sessionId !== request.sessionId) {
        return sessionError('invalid-response', requestId)
      }
      return reply
    },
  }
}

function clientRequest<Request, Reply extends { requestId: string | null }>(
  invoke: Invoke,
  channel: Parameters<Invoke>[0],
  check: (value: unknown) => value is Reply,
) {
  return async (request: Request) => {
    const requestId = requestIdentifier(request)
    const reply = await ask(() => invoke(channel, request), check, requestId)
    return answersRequest(reply, requestId) ? reply : sessionError('invalid-response', requestId)
  }
}
