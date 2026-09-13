import { randomUUID } from 'node:crypto'
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
  claudeSessionPermissionReplySchema,
  claudeSessionSendReplySchema,
  claudeSessionStartReplySchema,
  codexSessionSendReplySchema,
  codexSessionStartReplySchema,
  type SessionFeedReply,
  type SessionListReply,
  sessionError,
  sessionFeedReplySchema,
  sessionListReplySchema,
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

type Invoke = (operation: keyof typeof SESSION_OPERATIONS, request: unknown) => Promise<unknown>
type ReplySchema<Reply> = {
  safeParse(value: unknown): { success: boolean; data?: Reply }
}

// A reply that is not the shape asked for, or answers a different request, is refused rather
// than drawn. `connection-lost` is the one failure the renderer cannot see any other way.
async function ask<Reply>(
  invoke: () => Promise<unknown>,
  schema: ReplySchema<Reply>,
  requestId: string | null,
) {
  let reply: unknown
  try {
    reply = await invoke()
  } catch {
    return sessionError('connection-lost', requestId)
  }
  const parsed = schema.safeParse(reply)
  if (!parsed.success) return sessionError('invalid-response', requestId)
  return parsed.data as Reply
}

function answersRequest(reply: { requestId: string | null }, requestId: string | null) {
  return reply.requestId === requestId
}

export function createSessionClient(invoke: Invoke): SessionClient {
  return {
    interruptClaudeSession: clientRequest(invoke, 'interruptClaude', claudeSessionSendReplySchema),
    compactClaudeSession: clientRequest(invoke, 'compactClaude', claudeSessionSendReplySchema),
    sendClaudeSession: clientRequest(invoke, 'sendClaude', claudeSessionSendReplySchema),
    startClaudeSession: clientRequest(invoke, 'startClaude', claudeSessionStartReplySchema),
    readClaudePermission: clientRequest(
      invoke,
      'readClaudePermission',
      claudeSessionPermissionReplySchema,
    ),
    decideClaudePermission: clientRequest(
      invoke,
      'decideClaudePermission',
      claudeSessionSendReplySchema,
    ),
    interruptCodexSession: clientRequest(invoke, 'interruptCodex', codexSessionSendReplySchema),
    sendCodexSession: clientRequest(invoke, 'sendCodex', codexSessionSendReplySchema),
    startCodexSession: clientRequest(invoke, 'startCodex', codexSessionStartReplySchema),
    listSessions: () => clientRequest(invoke, 'list', sessionListReplySchema)(undefined),
    async readSessionFeed(request) {
      const requestId = randomUUID()
      const message = { ...request, version: 1, type: SESSION_OPERATIONS.feed.name, requestId }
      const reply = await ask(() => invoke('feed', message), sessionFeedReplySchema, requestId)
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
  operation: Parameters<Invoke>[0],
  schema: ReplySchema<Reply>,
) {
  return async (request: Request) => {
    const requestId = randomUUID()
    const message = { ...request, version: 1, type: SESSION_OPERATIONS[operation].name, requestId }
    const reply = await ask(() => invoke(operation, message), schema, requestId)
    return answersRequest(reply, requestId) ? reply : sessionError('invalid-response', requestId)
  }
}
