import { createDomainClient } from '../contract/domain'
import {
  type SessionAcceptedReply,
  type SessionFeedReply,
  type SessionListReply,
  type SessionPermissionReply,
  type SessionRenameReply,
  type SessionStartReply,
  sessionError,
} from './contract'
import { SESSION_OPERATIONS } from './operations'

export type SessionClient = {
  startSession(request: {
    cli: string
    cwd: string
    prompt: string
    setup?: unknown
  }): Promise<SessionStartReply>
  sendSession(request: {
    sessionId: string
    prompt: string
    setup?: unknown
  }): Promise<SessionAcceptedReply>
  interruptSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readSessionPermission(request: { sessionId: string }): Promise<SessionPermissionReply>
  decideSessionPermission(request: {
    sessionId: string
    permissionId: string
    decision: 'allow' | 'deny'
  }): Promise<SessionAcceptedReply>
  listSessions(): Promise<SessionListReply>
  readSessionFeed(request: {
    sessionId: string
    revision: string | null
  }): Promise<SessionFeedReply>
  renameSession(request: { sessionId: string; name: string }): Promise<SessionRenameReply>
}

export function createSessionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): SessionClient {
  const client = createDomainClient(SESSION_OPERATIONS, invoke, sessionError)
  return {
    startSession: (request) => client.start(request),
    sendSession: (request) => client.send(request),
    interruptSession: (request) => client.interrupt(request),
    readSessionPermission: (request) => client.readPermission(request),
    decideSessionPermission: (request) => client.decidePermission(request),
    listSessions: () => client.list(),
    renameSession: (request) => client.rename(request),
    async readSessionFeed(request) {
      const reply = await client.feed(request)
      // A Feed that answers for a different Session would draw one Session's history under
      // another's name, so the identity is checked and not assumed.
      if (reply.type === 'session.feed.read' && reply.sessionId !== request.sessionId) {
        return sessionError('invalid-response', reply.requestId)
      }
      return reply
    },
  }
}
