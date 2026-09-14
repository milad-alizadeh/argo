import { createDomainClient } from '../contract/domain'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionPermissionDecisionReply,
  type ClaudeSessionPermissionReply,
  type ClaudeSessionSendReply,
  type ClaudeSessionStartReply,
  type ClaudeTurnSetup,
  type CodexSessionInterruptReply,
  type CodexSessionSendReply,
  type CodexSessionStartReply,
  type SessionFeedReply,
  type SessionListReply,
  sessionError,
} from './contract'
import { SESSION_OPERATIONS } from './operations'

export type SessionClient = {
  interruptClaudeSession(request: { sessionId: string }): Promise<ClaudeSessionInterruptReply>
  compactClaudeSession(request: { sessionId: string }): Promise<ClaudeSessionSendReply>
  sendClaudeSession(request: {
    sessionId: string
    prompt: string
    setup: ClaudeTurnSetup
  }): Promise<ClaudeSessionSendReply>
  startClaudeSession(request: {
    cwd: string
    prompt: string
    setup: ClaudeTurnSetup
  }): Promise<ClaudeSessionStartReply>
  readClaudePermission(request: { sessionId: string }): Promise<ClaudeSessionPermissionReply>
  decideClaudePermission(request: {
    sessionId: string
    permissionId: string
    decision: 'allow' | 'deny'
  }): Promise<ClaudeSessionPermissionDecisionReply>
  interruptCodexSession(request: { sessionId: string }): Promise<CodexSessionInterruptReply>
  sendCodexSession(request: { sessionId: string; prompt: string }): Promise<CodexSessionSendReply>
  startCodexSession(request: { cwd: string; prompt: string }): Promise<CodexSessionStartReply>
  listSessions(): Promise<SessionListReply>
  readSessionFeed(request: {
    sessionId: string
    revision: string | null
  }): Promise<SessionFeedReply>
}

export function createSessionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): SessionClient {
  const client = createDomainClient(SESSION_OPERATIONS, invoke, sessionError)
  return {
    interruptClaudeSession: (request) => client.interruptClaude(request),
    compactClaudeSession: (request) => client.compactClaude(request),
    sendClaudeSession: (request) => client.sendClaude(request),
    startClaudeSession: (request) => client.startClaude(request),
    readClaudePermission: (request) => client.readClaudePermission(request),
    decideClaudePermission: (request) => client.decideClaudePermission(request),
    interruptCodexSession: (request) => client.interruptCodex(request),
    sendCodexSession: (request) => client.sendCodex(request),
    startCodexSession: (request) => client.startCodex(request),
    listSessions: () => client.list(),
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
