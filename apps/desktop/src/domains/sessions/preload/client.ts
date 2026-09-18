import { createDomainClient } from '@/core/contract/domain'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import type { ClaudeQuestionAnswer } from '@/domains/sessions/contract/claude-contract'
import {
  type SessionAcceptedReply,
  type SessionArchiveListReply,
  type SessionArchiveSetReply,
  type SessionChooseAttachmentsReply,
  type SessionDelegationUsageReply,
  type SessionFeedReply,
  type SessionFileReply,
  type SessionListReply,
  type SessionPermissionDecisionRequest,
  type SessionPermissionReply,
  type SessionRenameReply,
  type SessionShellOutputReply,
  type SessionSkillReply,
  type SessionStartReply,
  type SessionStatAttachmentsReply,
  sessionError,
} from '@/domains/sessions/contract/contract'
import { SESSION_OPERATIONS } from '@/domains/sessions/contract/operations'

export type SessionClient = {
  startSession(request: {
    cli: string
    cwd: string
    prompt: string
    setup?: unknown
    attachments?: SessionAttachmentInput[]
  }): Promise<SessionStartReply>
  sendSession(request: {
    sessionId: string
    prompt: string
    setup?: unknown
    attachments?: SessionAttachmentInput[]
  }): Promise<SessionAcceptedReply>
  interruptSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  compactSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  handoffSession(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readSessionPermission(request: { sessionId: string }): Promise<SessionPermissionReply>
  decideSessionPermission(request: {
    sessionId: string
    permissionId: string
    decision: SessionPermissionDecisionRequest['decision']
  }): Promise<SessionAcceptedReply>
  decideSessionQuestion(request: {
    sessionId: string
    questionId: string
    answers: ClaudeQuestionAnswer[]
  }): Promise<SessionAcceptedReply>
  listSessions(request: {
    projectRoot: string | null
    cursor?: string | null
  }): Promise<SessionListReply>
  listArchivedSessions(request: {
    cursor: string | null
    restoreId: string | null
  }): Promise<SessionArchiveListReply>
  setSessionsArchived(request: {
    sessionIds: string[]
    archived: boolean
  }): Promise<SessionArchiveSetReply>
  readSessionFeed(request: {
    sessionId: string
    delegationId: string | null
    revision: string | null
  }): Promise<SessionFeedReply>
  readWorkspaceFile(request: { sessionId: string; path: string }): Promise<SessionFileReply>
  readSkillFile(request: { path: string }): Promise<SessionSkillReply>
  cancelSessionFeed(request: { sessionId: string }): Promise<SessionAcceptedReply>
  readShellOutput(request: { sessionId: string; shellId: string }): Promise<SessionShellOutputReply>
  readDelegationUsage(request: { sessionId: string }): Promise<SessionDelegationUsageReply>
  renameSession(request: { sessionId: string; name: string }): Promise<SessionRenameReply>
  connectSessionTicket(request: {
    sessionId: string
    projectId: string
    key: string
    title: string
    state: 'open' | 'closed'
  }): Promise<SessionAcceptedReply>
  disconnectSessionTicket(request: { sessionId: string }): Promise<SessionAcceptedReply>
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
    handoffSession: (request) => client.handoff(request),
    readSessionPermission: (request) => client.readPermission(request),
    decideSessionPermission: (request) => client.decidePermission(request),
    decideSessionQuestion: (request) => client.decideQuestion(request),
    listSessions: (request) => client.list(request),
    listArchivedSessions: (request) => client.archiveList(request),
    setSessionsArchived: (request) => client.archiveSet(request),
    readWorkspaceFile: (request) => client.file(request),
    readSkillFile: (request) => client.skill(request),
    readShellOutput: (request) => client.shellOutput(request),
    readDelegationUsage: (request) => client.delegationUsage(request),
    renameSession: (request) => client.rename(request),
    connectSessionTicket: (request) => client.connectTicket(request),
    disconnectSessionTicket: (request) => client.disconnectTicket(request),
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
    cancelSessionFeed: (request) => client.cancelFeed(request),
  }
}
