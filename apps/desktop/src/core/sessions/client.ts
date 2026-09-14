import { createDomainClient } from '../contract/domain'
import type { ClaudeQuestionAnswer } from './claude-contract'
import {
  type SessionAcceptedReply,
  type SessionArchiveListReply,
  type SessionChooseAttachmentsReply,
  type SessionFeedReply,
  type SessionListReply,
  type SessionPermissionReply,
  type SessionRenameReply,
  type SessionStartReply,
  type SessionStatAttachmentsReply,
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
  compactSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readSessionPermission(request: { sessionId: string }): Promise<SessionPermissionReply>
  decideSessionPermission(request: {
    sessionId: string
    permissionId: string
    decision: 'allow' | 'deny'
  }): Promise<SessionAcceptedReply>
  decideSessionQuestion(request: {
    sessionId: string
    questionId: string
    answers: ClaudeQuestionAnswer[]
  }): Promise<SessionAcceptedReply>
  listSessions(): Promise<SessionListReply>
  listArchivedSessions(request: {
    cursor: string | null
    restoreId: string | null
  }): Promise<SessionArchiveListReply>
  readSessionFeed(request: {
    sessionId: string
    revision: string | null
  }): Promise<SessionFeedReply>
  renameSession(request: { sessionId: string; name: string }): Promise<SessionRenameReply>
  chooseSessionAttachments(): Promise<SessionChooseAttachmentsReply>
  statSessionAttachments(request: { paths: string[] }): Promise<SessionStatAttachmentsReply>
}

export function createSessionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): SessionClient {
  const client = createDomainClient(SESSION_OPERATIONS, invoke, sessionError)
  return {
    startSession: (request) => client.start(request),
    sendSession: (request) => client.send(request),
    interruptSession: (request) => client.interrupt(request),
    compactSession: (request) => client.compact(request),
    readSessionPermission: (request) => client.readPermission(request),
    decideSessionPermission: (request) => client.decidePermission(request),
    decideSessionQuestion: (request) => client.decideQuestion(request),
    listSessions: () => client.list(),
    listArchivedSessions: (request) => client.archiveList(request),
    renameSession: (request) => client.rename(request),
    chooseSessionAttachments: () => client.chooseAttachments(),
    statSessionAttachments: (request) => client.statAttachments(request),
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
